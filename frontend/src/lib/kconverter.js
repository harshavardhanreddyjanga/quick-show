export const kconverter = (num)=>{
    if(num >= 1000){
        return (num/1000) + 'k'
    }
    else{
        return num
    }
}