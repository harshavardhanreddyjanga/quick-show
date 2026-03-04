
import { Inngest, step } from "inngest";
import User from "../models/user.js";
import Booking from "../models/Booking.js";
import Show from "../models/Show.js";
import sendEmail from "../configs/nodeMailer.js";


export const inngest = new Inngest({ id: "movie-ticket-booking" });

// inngest fn to save user data to the database
const syncUserCreation = inngest.createFunction(
    {id : 'sync-user-from-clerk'},
    {event:'clerk/user.created'},
    async ({event})=>{
        const {id,first_name,last_name,email_addresses,image_url} = event.data
        const userData = {
            _id : id,
            email : email_addresses[0].email_address,
            name : first_name + ' ' + last_name ,
            image : image_url 
        }
        await User.create(userData)
    }
)
// inngest fn to delete user data to the database

const syncUserDeletion= inngest.createFunction(
    {id : 'delete-user-from-clerk'},
    {event:'clerk/user.deleted'},
    async ({event})=>{
        const {id} = event.data
        await User.findByIdAndDelete(id)
    }
)

// inngest fn to delete user data to the database

const syncUserUpdate = inngest.createFunction(
    {id : 'update-user-from-clerk'},
    {event:'clerk/user.updated'},
    async ({event})=>{
        const {id,first_name,last_name,email_addresses,image_url} = event.data
         const userData = {
            _id : id,
            email : email_addresses[0].email_address,
            name : first_name + ' ' + last_name ,
            image : image_url 
        }
        await User.findByIdAndUpdate(id,userData)
    }
)

// inngest fn to cancel booking and release seats after 10 mins

const releaseSeatsAndDeleteBooking = inngest.createFunction(
    {id : 'release-seats-delete-booking'},
    {event : "app/checkpayment" },
    async ({ event , step }) => {
        const tenMinutesLater = new Date(Date.now() + 10 * 60 * 1000);
        await step.sleepUntil('wait-for-10-minutes',tenMinutesLater);
        await step.run('check-payment-status',async ()=>{
            const bookingId = event.data.bookingId;
            const booking = await Booking.findById(bookingId);
            console.log(booking._id , booking.isPaid);
            // if payment is not made delete seats and delette booking
            if(!booking.isPaid){
                const show = await Show.findById(booking.show)
                booking.bookedSeats.forEach((seat)=>{
                    delete show.occupiedSeats[seat];
                })
                show.markModified('occupiedSeats')
                await show.save();
                await Booking.findByIdAndDelete(booking._id);
            }
        })
    }
)

const sendBookingConfirmationEmail = inngest.createFunction(
    {id : 'send-booking-confirmation-email'},
    {event : 'app/show.booked'},
    async ({event,step}) => {
        const { bookingId } = event.data;
        const booking = await Booking.findById(bookingId).populate({
            path : 'show',
            populate : {path : 'movie', model : 'Movie'}
        }).populate('user');

        await sendEmail({
            to : booking.user.email,
            subject : `payment confirmation ${booking.show.movie.title} booked`,
            body : `
                    <div style="font-family: Arial, sans-serif; line-height: 1.5;">
                    <h2>Hi ${booking.user.name},</h2>

                    <p>
                        Your booking for <strong style="color: #F84565;">"${booking.show.movie.title}"</strong> is confirmed.
                    </p>

                    <p>
                        <strong>Date:</strong> ${
                        new Date(booking.show.showDateTime).toLocaleDateString('en-US', {
                            timeZone: 'Asia/Kolkata'
                        })
                        }<br/>

                        <strong>Time:</strong> ${
                        new Date(booking.show.showDateTime).toLocaleTimeString('en-US', {
                            timeZone: 'Asia/Kolkata'
                        })
                        }
                    </p>

                    <p>Enjoy the show! 🍿</p>

                    <p>
                        Thanks for booking with us!<br/>
                        — QuickShow Team
                    </p>
                    </div>
                    `
        })

    }
)

// ingest function to send remainders
const sendShowRemainder = inngest.createFunction(
    { id : "send-show-remainders" },
    { cron : "0 */1 * * *" }, //every 8 hrs
    async ({step}) => {
        const now = new Date()
        const in8hours = new Date(now.getTime() +  8 * 60 * 60 * 1000);
        const windowStart = new Date( in8hours.getTime() - 10*60*1000)

        // prepare remainder task
        const remainderTasks = await step.run("prepare-remainder-tasks",async()=>{
            const shows = await Show.find({
                showDateTime : { $gte : windowStart, $lte : in8hours  }
            }).populate('movie')
            const tasks = []
            for(const show of shows){
                if(!show.movie || !show.occupiedSeats){
                    continue
                }
                const userIds = [... new Set(Object.values(show.occupiedSeats))]
                if(userIds.length === 0)continue;
                const users = await User.find({_id : {$in : userIds}}).select('name email')

                for(const user of users){
                    tasks.push({
                        userEmail : user.email,
                        userName : user.name,
                        movieTitle : show.movie.title,
                        showTime : show.showDateTime
                    })
                }
            }
            return tasks;
        })
        if(remainderTasks.length == 0){
            return {sent : 0, message : "NO remainders to send"}
        }
        // send remainder emails

        const results = await step.run('all-remainders',async()=>{
            return await Promise.allSettled(
                remainderTasks.map(task => sendEmail({
                    to : task.userEmail,
                    subject : `Remainder : your movie ${task.movieTitle} starts soon`,
                    body: `<div style="font-family: Arial, sans-serif; padding: 20px;">
                            <h2>Hello ${task.userName},</h2>
                            <p>This is a quick reminder that your movie:</p>
                            <h3 style="color: #F84565;">"${task.movieTitle}"</h3>
                            <p>
                                is scheduled for <strong>${new Date(task.showTime)
                                .toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata' })}</strong> at
                                <strong>${new Date(task.showTime)
                                .toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata' })}</strong>.
                            </p>
                            <p>It starts in approximately <strong>8 hours</strong> - make sure you're ready!</p>
                            <br/>
                            <p>Enjoy the show!<br/>QuickShow Team</p>
                            </div>` 

                }))
            )
        })
        const sent = results.filter(r => r.status === 'fulfilled')
        const failed = results.length-sent

        return{
            sent,
            failed,
            message :  `sent ${ sent } remainder(s) , failed ${failed}`
        }
    }   
)

const sendNewShowNotification = inngest.createFunction(
    { id : "send-new-notification" },
    { event : "app/show.added" },
    async({ event }) => {
        const { movieTitle} = event.data;
        const users = await User.find({});

        for(const user of users){
            const userEmail = user.email;
            const userName = user.name; 
            const subject = `new show added : ${movieTitle}`;
            const body = `
                        <div style="font-family: Arial, sans-serif; padding: 20px;">
                            <h2>Hi ${userName},</h2>
                            <p>We've just added a new show to our library:</p>
                            <h3 style="color: #F84565;">"${movieTitle}"</h3>
                            <p>Visit our website</p>
                            <br/>
                            <p>Thanks,<br/>QuickShow Team</p>
                        </div>
                        `;

                        await sendEmail({
                            to:userEmail,
                            subject ,
                            body
                        })
        }

        return { message :"Notification sent" };
        
    }
)

export const functions = [
    syncUserCreation,
    syncUserDeletion,
    syncUserUpdate,
    releaseSeatsAndDeleteBooking,
    sendBookingConfirmationEmail,
    sendShowRemainder,
    sendNewShowNotification
];
// mongodb+srv://admin:tCBoXnokRmpEZ9np@cluster0.pehw2br.mongodb.net/