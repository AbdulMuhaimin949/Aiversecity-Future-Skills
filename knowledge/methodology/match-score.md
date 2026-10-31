---
title: How Aiversecity calculates a career match score
language: en
---

# How Aiversecity calculates a career match score

Aiversecity compares your skills profile with each role in its career catalogue and gives a match score from 0 to 100. The score is a transparent formula, not a machine-learning black box, and it supports your decision; it does not make hiring decisions.

## The formula

Score = 100 × (0.45 × O + 0.25 × A + 0.15 × E + 0.15 × M)

- O, skill overlap (45%): 0.75 × the share of the role's required skills you have + 0.25 × the share of its preferred skills you have.
- A, proficiency alignment (25%): the average, over the role's required and preferred skills, of min(1, your proficiency ÷ the required proficiency). Proficiency is on a 1 to 5 scale.
- E, education and experience readiness (15%): 0.5 if your education meets the role's minimum level, plus 0.5 × min(1, (your years of experience + 1) ÷ (required years + 1)).
- M, interest, learning feasibility and labour trend (15%): 0.4 if the role's sector is one of your interests, + 0.3 × learning feasibility, + 0.3 × scenario demand.

## Learning feasibility and demand

Learning feasibility compares the hours you can study (weekly learning hours × 26 weeks) with the hours needed to close your skill gaps; it is 1 when you have no gaps. Scenario demand is the role's projected demand change under the selected scenario, min-max normalised across roles.

## Skill gaps and pathways

A skill gap is a required or preferred skill you do not have, or one where your proficiency is below the required level. The reskilling pathway matches gaps to courses in the HRD Corp e-LATiH catalogue that list that skill. Gaps with no matching course are shown as uncovered; Aiversecity never invents courses.
