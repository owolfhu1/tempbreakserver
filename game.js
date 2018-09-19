const Constants = require('./constants/Constants');
const levels = require('./levels');
const SSCD = require('sscd').sscd;

const shuffle = a => {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
};

function Player(color) {
    this.points = 0;
    this.moving = false;
    this.balls = [{
        radius : 10,
        x : Math.floor(Math.random() * 550),
        y : 0,
        dir : {
            x : Math.random() > .5 ? -1 : 1,
            y : 2
        }
    }];
    this.paddle = {
        speed : 10,
        width : 100,
        moving : '',
        x : this.balls[0].x - 40 > 0 ? this.balls[0].x - 40 : 0,
        y : 0,
    };
    this.jumping = false;
    this.color = color;
}

const paddleHit = (ball, paddle) => {
    let zone = ball.x + ball.radius - paddle.x;
    return zone < 0 || zone > paddle.width ? '' :
        zone < paddle.width / 5 ? 'left' :
        zone > paddle.width - paddle.width / 5 ? 'right' : 'center';
};

function Game() {

    const colors = ['red', 'green', 'blue', 'yellow', 'purple'];
    const newColor = () => colors.splice(Math.floor(Math.random() * Math.floor(colors.length)), 1)[0];

    let players = {};
    let blocks = JSON.parse(JSON.stringify(levels[0]));
    let level = 1;

    this.playersLeft = () => Object.keys(players).length;
    this.removePlayer = name => delete players[name];
    this.move = (player, dir) => players[player].paddle.moving = dir;
    this.stay = (player, dir) => {
        if (players[player].paddle.moving === dir)
            players[player].paddle.moving = '';
    };
    this.jump = player => {
        if (players[player].paddle.y === 0)
            players[player].jumping = true;

        //check if player is directly under you
        Object.keys(players).forEach(key => {

            let otherPaddle = players[key].paddle;
            let myPaddle = players[player].paddle;
            if (
                key !== player &&
                otherPaddle.y === myPaddle.y - 5 &&
                (
                    otherPaddle.x < myPaddle.x && otherPaddle.x + otherPaddle.width > myPaddle.x ||
                    otherPaddle.x > myPaddle.x && otherPaddle.x < myPaddle.x + myPaddle.width
                      || otherPaddle.x === myPaddle.x
                )
            )
                players[player].jumping = true;

        });

//ok that wasnt it

        //this is suppost to check if you are right under a paddle and cancle a jump

    //i think the fix may be to account for yPotential here..? maybe... 
    //but also maybe better if i can figure out why its
    //happening in the first place

        //check if a player is on top of you
        Object.keys(players).forEach(key => {

            let otherPaddle = players[key].paddle;
            let myPaddle = players[player].paddle;
            if (
                key !== player &&
                otherPaddle.y === myPaddle.y + 5 &&
                (
                    otherPaddle.x < myPaddle.x && otherPaddle.x + otherPaddle.width > myPaddle.x ||
                    otherPaddle.x > myPaddle.x && otherPaddle.x < myPaddle.x + myPaddle.width
                    || otherPaddle.x === myPaddle.x
                )
            )
                players[player].jumping = false;

        });



    };
    this.startStop = player => players[player].isActive = !players[player].isActive;
    this.addPlayer = name => players[name] = new Player(newColor());
    this.getNextFrame = () => {

        for (let name in players) {

            let player = players[name];
            let myPaddle = player.paddle;

            //move paddle
            if (player.paddle.moving) {

                if (player.paddle.moving === 'left') {

                    let leftPaddle;
                    Object.keys(players).forEach(key => {
                        let otherPaddle = players[key].paddle;
                        if (
                            key !== name &&
                            otherPaddle.y >= myPaddle.y &&
                            (
                                otherPaddle.y < myPaddle.y && otherPaddle.y + 5 > myPaddle.y ||
                                otherPaddle.y > myPaddle.y && otherPaddle.y < myPaddle.y + 5 ||
                                otherPaddle.y === myPaddle.y
                            ) &&
                            otherPaddle.width + otherPaddle.x >= myPaddle.x - myPaddle.speed &&
                            myPaddle.x - myPaddle.speed > otherPaddle.x
                        )
                            leftPaddle = otherPaddle;
                    });
                    if (leftPaddle)
                        myPaddle.x = leftPaddle.width + leftPaddle.x;
                    else if (myPaddle.x - myPaddle.speed < 0)
                        myPaddle.x = 0;
                    else
                        myPaddle.x = myPaddle.x - myPaddle.speed;

                } else {

                    let rightPaddle;
                    Object.keys(players).forEach(key => {
                        let otherPaddle = players[key].paddle;
                        if (
                            key !== name &&
                            otherPaddle.y >= myPaddle.y &&
                            (
                                otherPaddle.y < myPaddle.y && otherPaddle.y + 5 > myPaddle.y ||
                                otherPaddle.y > myPaddle.y && otherPaddle.y < myPaddle.y + 5 ||
                                otherPaddle.y === myPaddle.y
                            ) &&
                            otherPaddle.x <= myPaddle.x + myPaddle.speed + myPaddle.width &&
                            myPaddle.x + myPaddle.speed < otherPaddle.x
                        )
                            rightPaddle = otherPaddle;
                    });
                    if (rightPaddle)
                        myPaddle.x = rightPaddle.x - myPaddle.width;
                    else if (myPaddle.x + myPaddle.speed + myPaddle.width > Constants.GAME_WIDTH)
                        myPaddle.x = Constants.GAME_WIDTH - myPaddle.width;
                    else
                        myPaddle.x = myPaddle.x + myPaddle.speed;

                }

            }


            //do jump w/ collision
            let yPotential = player.paddle.y < 40 ? 14 : player.paddle.y < 80 ? 7 : 2;

            if (player.jumping) {

                //holds potential paddles that are over me within range of my yPotential
                let abovePaddle;


                //look at every players paddle who isnt you
                Object.keys(players).forEach(key => {
                    if (key !== name) {

                        //another player's paddle
                        let otherPaddle = players[key].paddle;

                        if (
                            
                            ( //other players paddle is in x range of yours
                                otherPaddle.x < myPaddle.x && otherPaddle.x + otherPaddle.width > myPaddle.x ||
                                otherPaddle.x > myPaddle.x && otherPaddle.x < myPaddle.x + myPaddle.width ||
                                otherPaddle.x === myPaddle.x
                            ) &&

                            //and other players within yPotential
                            otherPaddle.y <= myPaddle.y + yPotential + 5 &&
                            myPaddle.y + 5 <= otherPaddle.y
                        )

                                //if all that then set the above paddle to this guys
                            abovePaddle = otherPaddle;
                    }
                });


                //if they are tooooo high, start falling
                if (player.paddle.y >= 100)
                    player.jumping = false;
   
                else if (abovePaddle) {//if we found a paddle
                    player.jumping = false;//stop jumping
                    myPaddle.y = abovePaddle.y - 5; //move to right under abovePaddle i see//so you should look like you are hiting them and thens tart falling
                } else                
                    myPaddle.y = myPaddle.y + yPotential;
            }

            //do fall w/ collision
            else if (myPaddle.y !== 0) {

                let underPaddle;

                Object.keys(players).forEach(key => {
                    if (key !== name) {

                        let otherPaddle = players[key].paddle;
                        if (
                            (
                                otherPaddle.x < myPaddle.x && otherPaddle.x + otherPaddle.width > myPaddle.x ||
                                otherPaddle.x > myPaddle.x && otherPaddle.x < myPaddle.x + myPaddle.width ||
                                otherPaddle.x === myPaddle.x
                            )
                            &&
                            otherPaddle.y + 5 >= myPaddle.y - yPotential &&
                            myPaddle.y - 5 >= otherPaddle.y
                        )
                            underPaddle = otherPaddle;
                    }
                });

                if (underPaddle) {
                    myPaddle.y = underPaddle.y + 5;
                } else
                    myPaddle.y = myPaddle.y - yPotential;
                if (myPaddle.y < 0)//hmm im so cunfused lol
                    myPaddle.y = 0;

            }

            //move ball
            if (player.isActive) {


                for (let b in player.balls) {

                    let ball = player.balls[b];

                    let nextBall = {
                        x: ball.x + ball.dir.x,
                        y: ball.y + ball.dir.y,
                    };
                    let bounceOfBlock;

                    let deletedX = 0;
                    let deletedY = 0;

                    //check if it will hit a block
                    for (let i in blocks) {

                        if (blocks[i] && deletedX + deletedY === 0) {

                            let {width, height} = blocks[i];
                            let x = blocks[i].left;
                            let y = blocks[i].bottom;

                            if (ball.x > x - ball.radius &&
                                ball.y < y + ball.radius &&
                                ball.x < x + width &&
                                ball.y < y + height) {


                                const testBall = new SSCD.World();
                                //
                                // const middleBall = new SSCD.World();
                                //
                                // middleBall.add(new SSCD.Circle(
                                //     new SSCD.Vector(ball.x + (.5 * ball.dir.x) + ball.radius, ball.y + (.5 * ball.dir.y) + ball.radius),
                                //     ball.radius));

                                testBall.add(new SSCD.Circle(
                                    new SSCD.Vector(nextBall.x + ball.radius, nextBall.y + ball.radius),
                                    ball.radius));

                                let result = '';

                                let functions = [];


                                // functions.push(
                                //     () => {
                                //         if (middleBall.test_collision(new SSCD.Line(new SSCD.Vector(x, y), new SSCD.Vector(x + width, y))))
                                //             result = 'bottom';
                                //     }
                                // );
                                //
                                // functions.push(
                                //     () => {
                                //         if (middleBall.test_collision(new SSCD.Line(new SSCD.Vector(x, y), new SSCD.Vector(x, y + height))))
                                //             result = 'left';
                                //     }
                                // );
                                //
                                // functions.push(
                                //     () => {
                                //         if (middleBall.test_collision(new SSCD.Line(new SSCD.Vector(x, y + height), new SSCD.Vector(x + width, y + height))))
                                //             result = 'top';
                                //     }
                                // );
                                //
                                // functions.push(
                                //     () => {
                                //         if (middleBall.test_collision(new SSCD.Line(new SSCD.Vector(x + width, y + height), new SSCD.Vector(x + width, y))))
                                //             result = 'right';
                                //     }
                                // );
                                //
                                // functions = shuffle(functions);
                                //
                                // functions[0]();
                                //
                                // if (!result)
                                //     functions[1]();
                                // if (!result)
                                //     functions[2]();
                                // if (!result)
                                //     functions[3]();

                                if (!result) {

                                    //functions = [];

                                    functions.push(
                                        () => {
                                            if (testBall.test_collision(new SSCD.Line(new SSCD.Vector(x, y), new SSCD.Vector(x + width, y))))
                                                result = 'bottom';
                                        }
                                    );

                                    functions.push(
                                        () => {
                                            if (testBall.test_collision(new SSCD.Line(new SSCD.Vector(x, y), new SSCD.Vector(x, y + height))))
                                                result = 'left';
                                        }
                                    );

                                    functions.push(
                                        () => {
                                            if (testBall.test_collision(new SSCD.Line(new SSCD.Vector(x, y + height), new SSCD.Vector(x + width, y + height))))
                                                result = 'top';
                                        }
                                    );

                                    functions.push(
                                        () => {
                                            if (testBall.test_collision(new SSCD.Line(new SSCD.Vector(x + width, y + height), new SSCD.Vector(x + width, y))))
                                                result = 'right';
                                        }
                                    );


                                    functions = shuffle(functions);

                                    functions[0]();

                                    if (!result)
                                        functions[1]();
                                    if (!result)
                                        functions[2]();
                                    if (!result)
                                        functions[3]();

                                }
                                //
                                // if (testBall.test_collision(new SSCD.Line(new SSCD.Vector(x, y), new SSCD.Vector(x + width, y))))
                                //     result = 'bottom';
                                //
                                //
                                // else if (testBall.test_collision(new SSCD.Line(new SSCD.Vector(x, y), new SSCD.Vector(x, y + height))))
                                //     result = 'left';
                                // else if (testBall.test_collision(new SSCD.Line(new SSCD.Vector(x, y + height), new SSCD.Vector(x + width, y + height))))
                                //     result = 'top';
                                // else if (testBall.test_collision(new SSCD.Line(new SSCD.Vector(x + width, y + height), new SSCD.Vector(x + width, y))))
                                //     result = 'right';



                                if (result) {

                                    delete blocks[i];
                                    player.points++;
                                    bounceOfBlock = true;

                                    if (result === 'top' || result === 'bottom') {
                                        ball.dir.y = ball.dir.y * -1;
                                        deletedY++;
                                    } else if (result === 'left' || result === 'right') {
                                        ball.dir.x = ball.dir.x * -1;
                                        deletedX++;
                                    }


                                }

                            }

                        }

                    }

                    //move the ball
                    if (!bounceOfBlock) {
                        ball.x += ball.dir.x;
                        ball.y += ball.dir.y;
                    } else {
                        if (deletedY % 2 === 0 && deletedY !== 0) ball.dir.y = ball.dir.y * -1;
                        if (deletedX % 2 === 0 && deletedX !== 0) ball.dir.x = ball.dir.x * -1;
                    }

                    //bounce off walls
                    if (ball.x > Constants.GAME_HEIGHT - 2 * ball.radius) {
                        ball.x = Constants.GAME_HEIGHT - 2 * ball.radius;
                        ball.dir.x = -1 * ball.dir.x;
                    } else if (ball.y > Constants.GAME_WIDTH - 2 * ball.radius) {
                        ball.y = Constants.GAME_WIDTH - 2 * ball.radius;
                        ball.dir.y = -1 * ball.dir.y
                    } else if (ball.x < 0) {
                        ball.x = 0;
                        ball.dir.x = -1 * ball.dir.x;
                    }

                    //bounce off a paddle
                    for (let key in players) {
                        let paddle = players[key].paddle;
                        let jumping = players[key].jumping;
                        if (
                            ball.y < paddle.y &&
                            paddleHit(ball, paddle) &&
                            ball.dir.y < 0
                        ) {
                            ball.dir.y = jumping ? Math.abs(ball.dir.y) + 1 : 1;
                            ball.dir.x = paddleHit(ball, paddle) === 'center' ? (ball.dir.x > 0 ? 1 : -1) :
                                (paddleHit(ball, paddle) === 'left' ? -2 : 2);
                            players[key].balls.push(player.balls.splice(b * 1, 1)[0]);

                        }

                    }


                }//let b in balls


            }


        }








        //load next level if needed
        if (blocks.every(block => !block))
            blocks = JSON.parse(JSON.stringify(levels[level++]));

        //check if anyone is out of bounds. If so, deduct some points and turn them around.
        Object.keys(players).forEach(player => {
            for (let b in players[player].balls) {
                let ball = players[player].balls[b];
                if (ball.y < -5 && ball.dir.y < 0) {
                    players[player].points = players[player].points - 20;
                    ball.dir.y = 1;
                }
            }
        });

        return {players, blocks};
    };
}

module.exports = Game;

