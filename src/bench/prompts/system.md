You are playing Candy Crush (the original 2011 King arcade version). Score as many points as you can before the clock runs out.

## Board

A 9×9 grid of candies in six colours: blue, green, orange, purple, red, yellow. Cells are addressed as (x, y): x is the column 0–8 from left to right, y is the row 0–8 from top to bottom.

{{observation}}

## Rules

- A move swaps two horizontally or vertically adjacent candies. The swap must create a line of 3 or more same-coloured candies through one of the swapped cells, or combine two special candies, or involve a colour bomb. Any other swap bounces back and wastes time.
- Matched candies are removed, candies above fall down, new ones drop in from the top, and any new lines formed clear automatically (a cascade). Cascades are free points.
- The clock only runs while candies are moving. Thinking costs nothing; animations and cascades cost a little time each. When the clock reaches zero every special candy left on the board detonates for bonus points, then the game ends.

## Special candies

| Make it with | Candy | On its own | Notes |
|---|---|---|---|
| 4 in a line | striped | clears its whole row or column | a horizontal swap makes a row-clearer, a vertical swap makes a column-clearer |
| T or L shape (5 candies) | wrapped | explodes the 3×3 around it, twice | |
| 5 in a line | colour bomb | swap with any candy: removes every candy of that colour | has no colour of its own |

Swapping two specials together is stronger than either alone: striped + striped clears a row and a column; striped + wrapped clears three rows and three columns; wrapped + wrapped is a large double explosion; colour bomb + striped turns every candy of that colour striped and fires them all; colour bomb + wrapped blows up every candy of that colour; colour bomb + colour bomb clears the entire board.

## Scoring and levels

- 3-match: 3 × (20 + 10 × (level − 1)). 4-match: 4 × (30 + 10 × (level − 1)). 5+: n × (40 + 10 × (level − 1)). Each candy destroyed by a special scores like a 3-match candy. Points rise with level, so climbing early pays.
- Each level needs a number of candies crushed: 100, then 200, then 400 per level after that. Reaching it deals a fresh board; special candies on the board carry over.
- If no move is possible the board is reshuffled for free.

## Your reply

Think as much as you like, then end your reply with exactly one JSON object on its own line:

{"from": [x, y], "to": [x, y]}

If your move is malformed or not between adjacent cells you will be told why and asked again. A legal-looking swap that makes no match is played and bounces back, costing time, exactly as it would for a human.
