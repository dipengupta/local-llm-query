from django.conf import settings
from django.db import models
from django.db.models import Q


class Season(models.Model):
    year = models.IntegerField(unique=True)
    start_date = models.DateField()
    end_date = models.DateField()

    class Meta:
        db_table = "socialcomm_season"
        ordering = ["year"]

    def __str__(self) -> str:
        return str(self.year)


class Team(models.Model):
    name = models.CharField(max_length=100)
    theme_color = models.CharField(max_length=32, blank=True)
    is_active = models.BooleanField(default=True)
    season = models.ForeignKey(Season, on_delete=models.CASCADE, related_name="teams")

    class Meta:
        db_table = "socialcomm_team"
        constraints = [
            models.UniqueConstraint(fields=["season", "name"], name="uniq_team_season_name"),
        ]
        ordering = ["season__year", "name"]

    def __str__(self) -> str:
        return self.name


class Event(models.Model):
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    start_at = models.DateTimeField()
    end_at = models.DateTimeField(null=True, blank=True)
    location = models.CharField(max_length=200, blank=True)
    season = models.ForeignKey(Season, on_delete=models.CASCADE, related_name="events")

    class Meta:
        db_table = "socialcomm_event"
        ordering = ["start_at", "title"]

    def __str__(self) -> str:
        return self.title


class TeamMembership(models.Model):
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    team = models.ForeignKey(Team, on_delete=models.CASCADE, related_name="memberships")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="team_memberships")

    class Meta:
        db_table = "socialcomm_teammembership"
        constraints = [
            models.UniqueConstraint(fields=["user", "team", "start_date"], name="uniq_membership_user_team_start"),
        ]
        ordering = ["team__name", "user__username", "start_date"]

    def __str__(self) -> str:
        return f"{self.user} -> {self.team}"


class PointAward(models.Model):
    amount = models.IntegerField()
    awarded_at = models.DateTimeField()
    comment = models.CharField(max_length=255, blank=True)
    awarded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="awards_given",
    )
    awarded_to_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="awards_received",
    )
    awarded_to_team = models.ForeignKey(
        Team,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="awards_received",
    )
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="point_awards")

    class Meta:
        db_table = "socialcomm_pointaward"
        constraints = [
            models.CheckConstraint(
                condition=(
                    (Q(awarded_to_user__isnull=False) & Q(awarded_to_team__isnull=True))
                    | (Q(awarded_to_user__isnull=True) & Q(awarded_to_team__isnull=False))
                ),
                name="pointaward_xor_user_team",
            ),
        ]
        ordering = ["-awarded_at", "-id"]

    def __str__(self) -> str:
        return f"{self.amount} points"
