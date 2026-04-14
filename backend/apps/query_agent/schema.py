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
  id, username, first_name, last_name, email, is_active, is_staff, date_joined, last_login
)
socialcomm_season(
  id, year, start_date, end_date
)
socialcomm_team(
  id, name, theme_color, is_active, season_id
)
socialcomm_event(
  id, title, description, start_at, end_at, location, season_id
)
socialcomm_teammembership(
  id, start_date, end_date, team_id, user_id
)
socialcomm_pointaward(
  id, amount, awarded_at, comment, awarded_by_id, awarded_to_user_id, awarded_to_team_id, event_id
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
""".strip()
