--SELECT recipient, username FROM "Follows", "Users" WHERE "Follows".recipient="Users".id AND sender = 40;

SELECT * FROM
(
--Users X Owns
SELECT username, 'own' AS "action", own_date AS "date", '-' AS "participant", book as "book", '-' AS "message"
FROM "Users", "Owns"
WHERE "Users".id = "Owns".user


UNION


--Users X Wishes
SELECT username, 'wish' AS "action", wish_date AS "date", '-' AS "participant", book as "book", '-' AS "message"
FROM "Users", "Wishes"
WHERE "Users".id = "Wishes".user


UNION


--Users X Comments
SELECT username, 'comment' AS "action", comment_date AS "date", '-' AS "participant", book as "book", message AS "message"
FROM "Users", "Comments"
WHERE "Users".id = "Comments".user


UNION


--Users X Exchanges
SELECT
"Users1".username as "user",
'exchange' as "action",
date_exchange as "date",
"Users2".username as "participant",
want_book as "book",
'-' as "message"
FROM
(SELECT id as ex1_id, requestor as ex1_requestor, requested as ex1_requested, want_book,date_exchange FROM "Exchanges" WHERE status_requestor = 'completed' OR status_requestor = 'rated' OR status_requested = 'rated') as t1,
(SELECT id as ex2_id, requestor as ex2_requestor, requested as ex2_requested FROM "Exchanges") as t2,
"Users" as "Users1",
"Users" as "Users2"
WHERE ex1_id = ex2_id AND (ex1_requestor = "Users1".id AND ex2_requested = "Users2".id)


UNION


--Users X Follows
SELECT
sender as "user",
'follow' as "action",
follow_date as "date",
recip as "participant",
'-' as "book",
'-' as message 
FROM
(SELECT username as sender, sender as f1_sender, recipient as f1_recipient, follow_date FROM "Follows", "Users" WHERE "Users".id = sender)as a,
(SELECT sender as f2_sender, recipient as f2_recipient, username as recip FROM "Follows", "Users" WHERE "Users".id = recipient)as b
WHERE f1_sender = f2_sender AND  f1_recipient = f2_recipient


UNION


--Users X ExchangeReviews
SELECT
comtr as "user",
'review' as "action",
comment_date as "date",
comtee as "participant",
'-' as "book",
message
FROM
(SELECT "ExchangeReviews".id as er1_id, username as comtr, commenter as er1_commenter, commentee as er1_commentee, message, comment_date FROM "ExchangeReviews", "Users" WHERE "Users".id = commenter) as a,
(SELECT "ExchangeReviews".id as er2_id, commenter as er2_commenter, commentee as er2_commentee, username as comtee FROM "ExchangeReviews", "Users" WHERE "Users".id = commentee) as b
WHERE er1_id = er2_id

) as t WHERE username in (SELECT username FROM "Follows", "Users" WHERE "Follows".recipient="Users".id AND sender = 40);