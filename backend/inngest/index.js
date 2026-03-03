
import { Inngest } from "inngest";
import User from "../models/user.js";


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


export const functions = [syncUserCreation,syncUserDeletion,syncUserUpdate];
// mongodb+srv://admin:tCBoXnokRmpEZ9np@cluster0.pehw2br.mongodb.net/