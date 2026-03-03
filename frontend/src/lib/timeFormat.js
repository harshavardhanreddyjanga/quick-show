
const timeFormat = (min)=>{
    const hrs = Math.floor(min/60);
    const minutesRemainder = min%60;
    return `${hrs}h ${minutesRemainder}m`
}
export default timeFormat