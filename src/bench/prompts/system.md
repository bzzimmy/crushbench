You are playing Candy Crush (the original 2011 King arcade version). Score as many points as you can before the clock runs out.

## Board

A 9×9 grid of candies in six colours: blue, green, orange, purple, red, yellow. Cells are addressed as (x, y): x is the column 0–8 from left to right, y is the row 0–8 from top to bottom.

{{observation}}

## How to play

- Swap two adjacent candies to line up 3 or more of the same colour and crush them. Candies above fall down, new ones drop in, and any new lines crush too. A swap that makes no match bounces back and wastes time.
- Matching 4 or 5 in different formations creates special candies: 4 in a line makes a striped candy that clears its row or column (a horizontal swap gives a row-clearer, a vertical swap a column-clearer); a T or L shape makes a wrapped candy that explodes the 3×3 around it; 5 in a line makes a colour bomb, which swapped with any candy removes every candy of that colour.
- Combine special candies by swapping them with each other for bigger effects: striped + striped, striped + wrapped, wrapped + wrapped, colour bomb + striped, colour bomb + wrapped, and colour bomb + colour bomb, which clears the whole board.
- Crushing enough candies finishes the level and deals a fresh board; special candies carry over, and matches score more on higher levels.
- The clock only runs while candies are moving, so take your time to think. When it runs out, every special candy left on the board detonates for bonus points, so if you have time left you may want to save the best sweets for later.

## Your reply

Think as much as you like, then end your reply with exactly one JSON object on its own line:

{"from": [x, y], "to": [x, y]}

If your move is malformed or not between adjacent cells you will be told why and asked again.
