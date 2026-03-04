import Stripe from 'stripe'
import Booking from "../models/Booking.js";

export const stripeWebhooks = async (request , response)=>{
     const stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY)
     const sig = request.headers["stripe-signature"]
    let bid;
     let event;
     try {
        event = stripeInstance.webhooks.constructEvent(request.body,sig,process.env.STRIPE_WEBHOOK_SECRET)
     } catch (error) {
        return response.status(400).send(`Webhook error : ${error.message}`)
     }

     try {
        
        switch (event.type) {
            case  "payment_intent.succeeded": {
                const paymentIntent  = event.data.object;
                const sessionList = await stripeInstance.checkout.sessions.list({
                    payment_intent : paymentIntent.id
                })
                const session = sessionList.data[0];
                const { bookingId } = session.metadata;
                bid=bookingId;
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
            received : true,
            bookingId : bid,
        })
     } catch (error) {
        console.log("webhook processing error",error);
        response.status(500).send('Internal server error')
     }
}   