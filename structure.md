# Dashboard Structure
- Tägliche Aktivität (heatmap — GitHub-style contribution grid by day)

## Projektübersicht

- KPI: Durchschnittliche Wochenleistung (stat tile)
- KPI: Hauptfokus (stat tile)
- KPI: Durchschnittliche Issue-Abschlusszeit (stat tile)
- KPI: Aktivste Woche (stat tile)

## Aktivität

- Zeitaufwand pro Person & Kategorie (table — hours per person per category, week picker)
- Kategorie-Trend (AreaChart — hours per category over time)
- Aktivitätsverlauf (collapsible feed — time logs, issue opens/closes, comments)

## Kategorie-Analyse

- Burndown — kumulativer Verlauf (LineChart — cumulative opened vs. closed)
- Gebuchte Stunden pro Kategorie (wöchentlich) (BarChart — weekly hours per category)
- Issues pro Kategorie — Offen vs. Geschlossen (BarChart — open/closed count per category)
- Ø Bearbeitungszeit pro Kategorie (BarChart horizontal — avg cycle time per category)

## Issues

- Neue vs. geschlossene Issues pro Woche (BarChart — opened vs. closed per week)
- Issue-Baum (tree — epics and issues, filterable by state open/closed/all)

## Issue Analyse

- Geschätzt vs. Gebucht pro Kategorie (BarChart — estimated vs. actual hours per category)
- Issue Komplexität (BarChart — average hours per issue by category)
- Offene Issues nach Alter (BarChart — open issues bucketed by age)
- Schätzgenauigkeit — Geschätzt vs. Tatsächlich (ScatterChart — estimated vs. actual hours per issue)

## Zeitliche Entwicklung

- Kumulativer Fortschritt (AreaChart — cumulative hours over time)
- Team Aktivitätsvergleich (BarChart — hours per person per sprint, stacked/grouped)
- Wöchentliche Leistung (BarChart — total hours per sprint/week)
- Stunden pro Woche pro Person (LineChart — weekly hours per team member)

## Team & Kategorien

- Kategorie Verteilung (PieChart — share of hours per category)
- Kategorienverteilung pro Teammitglied (RadarCharts — one per member, categories as axes)
- Teammitglieder pro Kategorie (RadarCharts — one per category, members as axes)
- Team Aktivität (BarChart — total hours per team member)
- Letzte Buchung pro Teammitglied (list — last log date per person)

## Leaderboard

- Leaderboard (table — hours, issues worked/created/closed with % of total, sortable)

## Produktivitätsanalyse

- Tageszeitliche Verteilung (BarChart — hours booked by hour of day)
- Wöchentliche Verteilung (BarChart — hours booked by day of week)

## Team Zusammenarbeit

- Top Team Zusammenarbeit (cards — top pairs by shared issues)
- Ø Teammitglieder pro Issue (BarChart — average team size per category)