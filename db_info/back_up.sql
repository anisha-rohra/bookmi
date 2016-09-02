--sequences

CREATE SEQUENCE public."Comments_id_seq"
  INCREMENT 1
  MINVALUE 1
  MAXVALUE 9223372036854775807
  START 1
  CACHE 1;
ALTER TABLE public."Comments_id_seq"
  OWNER TO ujjikxvfoeetmy;


CREATE SEQUENCE public."Exchanges_id_seq"
  INCREMENT 1
  MINVALUE 1
  MAXVALUE 9223372036854775807
  START 1
  CACHE 1;
ALTER TABLE public."Exchanges_id_seq"
  OWNER TO ujjikxvfoeetmy;


CREATE SEQUENCE public."UserComments_id_seq"
  INCREMENT 1
  MINVALUE 1
  MAXVALUE 9223372036854775807
  START 1
  CACHE 1;
ALTER TABLE public."UserComments_id_seq"
  OWNER TO ujjikxvfoeetmy;


CREATE SEQUENCE public."Users_id_seq"
  INCREMENT 1
  MINVALUE 1
  MAXVALUE 9223372036854775807
  START 30
  CACHE 1;
ALTER TABLE public."Users_id_seq"
  OWNER TO ujjikxvfoeetmy;


CREATE SEQUENCE public.messages_id_seq
  INCREMENT 1
  MINVALUE 1
  MAXVALUE 9223372036854775807
  START 6
  CACHE 1;
ALTER TABLE public.messages_id_seq
  OWNER TO ujjikxvfoeetmy;













--tables

CREATE TABLE public."Users"
(
  id integer NOT NULL DEFAULT nextval('"Users_id_seq"'::regclass),
  firstname character varying NOT NULL,
  lastname character varying NOT NULL,
  username character varying NOT NULL,
  password character varying NOT NULL,
  email character varying NOT NULL,
  user_type character varying NOT NULL,
  age integer,
  gender character varying,
  location character varying,
  created timestamp with time zone NOT NULL DEFAULT now(),
  profile_pic character varying DEFAULT '-'::character varying,
  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT "Users_email_key" UNIQUE (email),
  CONSTRAINT "Users_username_key" UNIQUE (username),
  CONSTRAINT check_email CHECK (email::text ~~ '_%@_%._%'::text),
  CONSTRAINT check_user_type CHECK (user_type::text = 'admin'::text OR user_type::text = 'user'::text)
)
WITH (
  OIDS=FALSE
);
ALTER TABLE public."Users"
  OWNER TO ujjikxvfoeetmy;









CREATE TABLE public."Comments"
(
  id integer NOT NULL DEFAULT nextval('"Comments_id_seq"'::regclass),
  "user" integer NOT NULL,
  book character varying NOT NULL,
  comment_date timestamp with time zone NOT NULL DEFAULT now(),
  rating integer NOT NULL,
  message character varying NOT NULL,
  CONSTRAINT "Comments_pkey" PRIMARY KEY (id),
  CONSTRAINT "Comments_user_fkey" FOREIGN KEY ("user")
      REFERENCES public."Users" (id) MATCH SIMPLE
      ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "Comments_rating_check" CHECK (rating > 0 AND rating < 6)
)
WITH (
  OIDS=FALSE
);
ALTER TABLE public."Comments"
  OWNER TO ujjikxvfoeetmy;










CREATE TABLE public."ExchangeReviews"
(
  id integer NOT NULL DEFAULT nextval('"UserComments_id_seq"'::regclass),
  commenter integer NOT NULL,
  commentee integer NOT NULL,
  message character varying NOT NULL,
  rating integer,
  comment_date timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "UserComments_pkey" PRIMARY KEY (id),
  CONSTRAINT "UserComments_commentee_fkey" FOREIGN KEY (commentee)
      REFERENCES public."Users" (id) MATCH SIMPLE
      ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "UserComments_commenter_fkey" FOREIGN KEY (commenter)
      REFERENCES public."Users" (id) MATCH SIMPLE
      ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "ExchangeReviews_rating_check" CHECK (rating > 0 AND rating < 6)
)
WITH (
  OIDS=FALSE
);
ALTER TABLE public."ExchangeReviews"
  OWNER TO ujjikxvfoeetmy;









CREATE TABLE public."Exchanges"
(
  id integer NOT NULL DEFAULT nextval('"Exchanges_id_seq"'::regclass),
  requestor integer NOT NULL,
  requested integer NOT NULL,
  want_book character varying NOT NULL,
  own_book character varying NOT NULL,
  status character varying NOT NULL,
  date_exchange timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "Exchanges_pkey" PRIMARY KEY (id),
  CONSTRAINT "Exchanges_requested_fkey" FOREIGN KEY (requested)
      REFERENCES public."Users" (id) MATCH SIMPLE
      ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "Exchanges_requestor_fkey" FOREIGN KEY (requestor)
      REFERENCES public."Users" (id) MATCH SIMPLE
      ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "Exchanges_status_check" CHECK (status::text = 'requested'::text OR status::text = 'accepted'::text OR status::text = 'rejected'::text OR status::text = 'completed'::text)
)
WITH (
  OIDS=FALSE
);
ALTER TABLE public."Exchanges"
  OWNER TO ujjikxvfoeetmy;










CREATE TABLE public."Follows"
(
  sender integer NOT NULL,
  recipient integer NOT NULL,
  follow_date timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "Follows_pkey" PRIMARY KEY (sender, recipient, follow_date),
  CONSTRAINT "Follows_recipient_fkey" FOREIGN KEY (recipient)
      REFERENCES public."Users" (id) MATCH SIMPLE
      ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "Follows_sender_fkey" FOREIGN KEY (sender)
      REFERENCES public."Users" (id) MATCH SIMPLE
      ON UPDATE CASCADE ON DELETE CASCADE
)
WITH (
  OIDS=FALSE
);
ALTER TABLE public."Follows"
  OWNER TO ujjikxvfoeetmy;









CREATE TABLE public."Messages"
(
  id integer NOT NULL DEFAULT nextval('messages_id_seq'::regclass),
  prev_id integer,
  "to" integer NOT NULL,
  "from" integer NOT NULL,
  message character varying NOT NULL,
  message_date timestamp with time zone NOT NULL DEFAULT now(),
  message_read boolean NOT NULL DEFAULT false,
  subject character varying,
  CONSTRAINT messages_pkey PRIMARY KEY (id),
  CONSTRAINT messages_from_fkey FOREIGN KEY ("from")
      REFERENCES public."Users" (id) MATCH SIMPLE
      ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT messages_prevmsg_fkey FOREIGN KEY (prev_id)
      REFERENCES public."Messages" (id) MATCH SIMPLE
      ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT messages_to_fkey FOREIGN KEY ("to")
      REFERENCES public."Users" (id) MATCH SIMPLE
      ON UPDATE CASCADE ON DELETE CASCADE
)
WITH (
  OIDS=FALSE
);
ALTER TABLE public."Messages"
  OWNER TO ujjikxvfoeetmy;







CREATE TABLE public."Owns"
(
  "user" integer NOT NULL,
  book character varying NOT NULL,
  condition character varying NOT NULL,
  details character varying,
  CONSTRAINT "Owns_pkey" PRIMARY KEY ("user", book, condition),
  CONSTRAINT "Owns_user_fkey" FOREIGN KEY ("user")
      REFERENCES public."Users" (id) MATCH SIMPLE
      ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "Owns_condition_check" CHECK (condition::text = 'poor'::text OR condition::text = 'fair'::text OR condition::text = 'excellent'::text)
)
WITH (
  OIDS=FALSE
);
ALTER TABLE public."Owns"
  OWNER TO ujjikxvfoeetmy;








CREATE TABLE public."Wishes"
(
  "user" integer NOT NULL,
  book character varying NOT NULL,
  CONSTRAINT "Wishes_pkey" PRIMARY KEY ("user", book),
  CONSTRAINT "Wishes_user_fkey" FOREIGN KEY ("user")
      REFERENCES public."Users" (id) MATCH SIMPLE
      ON UPDATE CASCADE ON DELETE CASCADE
)
WITH (
  OIDS=FALSE
);
ALTER TABLE public."Wishes"
  OWNER TO ujjikxvfoeetmy;
