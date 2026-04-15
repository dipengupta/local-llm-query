ALLOWED_TABLES = {
    "auth_user",
    "socialcomm_season",
    "socialcomm_team",
    "socialcomm_event",
    "socialcomm_teammembership",
    "socialcomm_pointaward",
}

SCHEMA_DESCRIPTION = """
You can only query these PostgreSQL tables:

auth_user(
  id integer primary key,
  username varchar(150) not null,
  first_name varchar(150) not null,
  last_name varchar(150) not null,
  email varchar(254) not null,
  is_active boolean not null,
  is_staff boolean not null,
  date_joined timestamp not null,
  last_login timestamp null
)
socialcomm_season(
  id bigint primary key,
  year integer unique not null,
  start_date date not null,
  end_date date not null
)
socialcomm_team(
  id bigint primary key,
  name varchar(100) not null,
  theme_color varchar(32) not null default '',
  is_active boolean not null,
  season_id bigint not null references socialcomm_season(id),
  unique(season_id, name)
)
socialcomm_event(
  id bigint primary key,
  title varchar(200) not null,
  description text not null default '',
  start_at timestamp not null,
  end_at timestamp null,
  location varchar(200) not null default '',
  season_id bigint not null references socialcomm_season(id)
)
socialcomm_teammembership(
  id bigint primary key,
  start_date date not null,
  end_date date null,
  team_id bigint not null references socialcomm_team(id),
  user_id integer not null references auth_user(id),
  unique(user_id, team_id, start_date)
)
socialcomm_pointaward(
  id bigint primary key,
  amount integer not null,
  awarded_at timestamp not null,
  comment varchar(255) not null default '',
  awarded_by_id integer null references auth_user(id),
  awarded_to_user_id integer null references auth_user(id),
  awarded_to_team_id bigint null references socialcomm_team(id),
  event_id bigint not null references socialcomm_event(id)
)

Relationship notes:
- socialcomm_team.season_id -> socialcomm_season.id
- socialcomm_event.season_id -> socialcomm_season.id
- socialcomm_teammembership.team_id -> socialcomm_team.id
- socialcomm_teammembership.user_id -> auth_user.id
- socialcomm_pointaward.event_id -> socialcomm_event.id
- socialcomm_pointaward.awarded_to_user_id -> auth_user.id
- socialcomm_pointaward.awarded_to_team_id -> socialcomm_team.id
- socialcomm_pointaward.awarded_by_id -> auth_user.id

Semantic notes:
- auth_user is the Django user table for people.
- socialcomm_team.theme_color, socialcomm_event.description, socialcomm_event.location, and socialcomm_pointaward.comment use empty strings instead of null when blank.
- socialcomm_teammembership.end_date null usually means the membership is ongoing.
- socialcomm_pointaward awards exactly one target: either awarded_to_user_id or awarded_to_team_id is set, never both.
- For person names, prefer combining first_name and last_name, and fall back to username when names are blank.
- When filtering by person or team names from user input, prefer case-insensitive partial matching such as `LIKE '%value%'` or `ILIKE '%value%'` instead of exact equality unless the user explicitly asks for an exact match.
""".strip()
