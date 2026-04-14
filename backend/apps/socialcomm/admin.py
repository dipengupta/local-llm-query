from django.contrib import admin

from apps.socialcomm.models import Event, PointAward, Season, Team, TeamMembership


admin.site.register(Season)
admin.site.register(Team)
admin.site.register(Event)
admin.site.register(TeamMembership)
admin.site.register(PointAward)
