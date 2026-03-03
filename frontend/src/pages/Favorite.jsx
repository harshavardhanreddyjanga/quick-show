import React from 'react'
import { dummyShowsData } from '../assets/assets'
import MovieCard from '../components/MovieCard'
import BlurCircle from '../components/BlurCircle'
import { useAppContext } from '../context/AppContext'

function Favorite() {
   const { favoriteMovies } = useAppContext()
  return favoriteMovies.length > 0 ?  (
    <div className='relative my-40 mb-60 px-6 md:px-16 lg:px-40 xl:px-44 overflow-hidden min-h-[80vh]'>  

      <BlurCircle top='150px' left='0px'/>
      <BlurCircle bottom='50px' right='50px'/>

       <h1 className='text-lg font-medium my-4'>Your Favorites </h1>

        <div className='flex flex-wrap max-sm:justify-center gap-8'>
            {favoriteMovies.map((movie)=>{
           return  <MovieCard movie={movie} key={movie._id}/>
      })}
     
      </div>
    </div>
  
  ) : (
    <div className='h-screen flex flex-col items-center justify-center text-xl text-gray-300 '>
      No movies available
    </div>
  )
}

export default Favorite