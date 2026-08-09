from datetime import datetime, timedelta


def calculate_priority(subject, today):
    """
    Calculate a scheduling score for a subject.

    Higher score = higher scheduling priority.
    """

    score = 0

    # Difficulty
    difficulty_scores = {
        "Easy": 1,
        "Moderate": 2,
        "Hard": 3
    }

    score += difficulty_scores.get(
        subject.difficulty,
        1
    )

    # User priority
    priority_scores = {
        "Low": 1,
        "Medium": 2,
        "High": 3
    }

    score += priority_scores.get(
        subject.priority,
        2
    )

    # Exam urgency
    if subject.exam_date:

        days_left = (
            subject.exam_date - today
        ).days

        if days_left <= 3:
            score += 5

        elif days_left <= 7:
            score += 4

        elif days_left <= 14:
            score += 3

        elif days_left <= 30:
            score += 2

        else:
            score += 1

    return score


def generate_daily_schedule(
    subjects,
    available_hours,
    today
):
    """
    Generate today's study schedule.
    """

    if not subjects:
        return []

    # Calculate score for every subject
    scored_subjects = []

    for subject in subjects:

        score = calculate_priority(
            subject,
            today
        )

        scored_subjects.append(
            (subject, score)
        )

    # Highest priority first
    scored_subjects.sort(
        key=lambda item: item[1],
        reverse=True
    )

    schedule = []

    remaining_hours = available_hours

    for subject, score in scored_subjects:

        if remaining_hours <= 0:
            break

        # Default study block
        study_hours = min(
            1.5,
            remaining_hours
        )

        schedule.append({
            "subject_id": subject.id,
            "subject": subject.name,
            "hours": study_hours,
            "priority_score": score
        })

        remaining_hours -= study_hours

    return schedule