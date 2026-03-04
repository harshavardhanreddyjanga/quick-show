
import { Inngest } from "inngest";
import User from "../models/user.js";
import Booking from "../models/Booking.js";
import Show from "../models/Show.js";


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
        await step.run('check-payment-status',async (e)=>{
            const bookingId = e.data.bookingId;
            const booking = await Booking.findById(bookingId);
            // if payment is not made delete seats and delette booking
            if(!booking.isPaid){
                const show = await Show.findById(booking.show)
                booking.bookedSeats.forEach((seat)=>{
                    delete show.occupiedSeats[seat];
                })
                show.markModified('occupiedSeats')
                await show.save();
                await Booking.findByIdAndDelete(booking.Id);
            }
        })
    }
)

export const functions = [syncUserCreation,syncUserDeletion,syncUserUpdate,releaseSeatsAndDeleteBooking];
// mongodb+srv://admin:tCBoXnokRmpEZ9np@cluster0.pehw2br.mongodb.net/