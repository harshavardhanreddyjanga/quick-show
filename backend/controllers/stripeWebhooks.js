import stripe from "stripe";
import Booking from "../models/Booking.js";

export const stripeWebhooks = async (request , response)=>{
     const stripeInstance = new stripe(process.env.STRIPE_SECRET_KEY)
     const sig = request.headers["stripe-signature"]

     let event;
     try {
        event = stripeInstance.webhooks.constructEvent(request.body,sig,process.env.STRIPE_WEBHOOK_SECRET)
     } catch (error) {
        return response.status(400).send(`Webhhok error : ${error.message}`)
     }

     try {
        
        switch (event.type) {
            case "payment_intent.succeeded": {
                const paymentIntent  = event.data.object;
                const sessionList = await stripeInstance.checkout.sessions({
                    payment_intent : paymentIntent.id
                })
                const session = sessionList.data[0];
                const { bookingId } = session.metadata;
                await Booking.findByIdAndUpdate(bookingId,{
                    isPaid : true,
                    paymentLink : "",
                });
                break;
            }
            default:
                console.log("unhandled event type" , event.type)
        }
        response.json({
            recieved : true
        })
     } catch (error) {
        console.log("webhook processing error",err);
        response.status(500).send('Internal server error')
     }

}   