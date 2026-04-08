let matrix = Array.from({length:3}, ()=> Array(3));
//console.log(matrix);
let filledByOne = [];
let filledByTwo = [];
let mp = new Map();
let x=0;

for(let i =0; i<3; i++){
    for(let j =0; j<3; j++){
        //matrix[i][j].push(x);
        matrix[i][j]=x;
        x++;
    }
}

// function play1(i,j){
//     if (([i,j] in filledByOne) || ([i,j] in filledByTwo)) console.log("place already");
//     else{       
//         filledByOne.push([i,j]);
        
//     }
// }

// function play2(i,j){
//     if (([i,j] in filledByOne) || ([i,j] in filledByTwo)) console.log("place already");
//     else{
//         filledByTwo.push([i,j]);
//     }
// }

function win(input, XY){
   let pattern = [ [0,1,2], [3,4,5], [6,7,8], [0,3,6], [1,4,7], [2,5,8], [0,4,8], [2,4,6] ];
   //let Patternset = new Set(pattern);
   let count = 0
   for(let i = 0; i<= patterns.length; i++ ){
    if (pattern[i].has(input)){
    for(let j=0; j<= patterns[0].length; j++){
        if ((mp.get(pattern[i][j]) == XY) && count<3){
            count++;
            if (count == 3){
            console.log(`${mp.get(input)}"won the match"`);
        }
        else if {}
        }
        
    }
}
   }
}

