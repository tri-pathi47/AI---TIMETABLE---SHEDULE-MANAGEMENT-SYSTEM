from datetime import datetime, timedelta


# ============================================================
# CALCULATE SUBJECT PRIORITY
# ============================================================

def calculate_priority(subject, today):
    """
    Calculate how important a subject is to study today.

    Higher score = higher priority.
    """

    score = 0

    # --------------------------------------------------------
    # Difficulty
    # --------------------------------------------------------

    difficulty_scores = {
        "Easy": 1,
        "Moderate": 2,
        "Hard": 3
    }

    score += difficulty_scores.get(
        subject.difficulty,
        1
    )

    # --------------------------------------------------------
    # User priority
    # --------------------------------------------------------

    priority_scores = {
        "Low": 1,
        "Medium": 2,
        "High": 3
    }

    score += priority_scores.get(
        subject.priority,
        2
    )

    # --------------------------------------------------------
    # Exam urgency
    # --------------------------------------------------------

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


# ============================================================
# GET TODAY'S COMPLETED HOURS
# ============================================================

def get_recent_completed_hours(
    subject_id,
    user_id,
    today
):
    """
    Get study hours completed for a subject today.
    """

    from app.models import Timetable

    completed_records = Timetable.query.filter_by(
        user_id=user_id,
        subject_id=subject_id,
        date=today,
        completed=True
    ).all()

    completed_hours = sum(
        record.study_hours
        for record in completed_records
    )

    return completed_hours


# ============================================================
# GET TOTAL COMPLETED HOURS
# ============================================================

def get_completed_hours(
    subject_id,
    user_id
):
    """
    Calculate total study hours completed
    for a subject.
    """

    from app.models import Timetable

    records = Timetable.query.filter_by(
        subject_id=subject_id,
        user_id=user_id,
        completed=True
    ).all()

    return sum(
        record.study_hours
        for record in records
    )


# ============================================================
# GET REMAINING STUDY HOURS
# ============================================================

def get_remaining_hours(
    subject,
    user_id
):
    """
    Calculate remaining study hours
    for a subject.
    """

    estimated_hours = (
        subject.estimated_hours or 0
    )

    completed_hours = get_completed_hours(
        subject.id,
        user_id
    )

    remaining_hours = (
        estimated_hours - completed_hours
    )

    return max(
        remaining_hours,
        0
    )


# ============================================================
# GENERATE DAILY SCHEDULE
# ============================================================

def generate_daily_schedule(
    subjects,
    available_hours,
    today,
    user_id=None
):
    """
    Generate today's adaptive study schedule.

    Considers:
    - difficulty
    - user priority
    - exam urgency
    - completed hours
    - remaining estimated hours
    """

    if not subjects:
        return []

    if available_hours <= 0:
        return []

    scored_subjects = []

    # ========================================================
    # CALCULATE PRIORITY
    # ========================================================

    for subject in subjects:

        # Base priority
        score = calculate_priority(
            subject,
            today
        )

        completed_today = 0

        if user_id is not None:

            completed_today = get_recent_completed_hours(
                subject.id,
                user_id,
                today
            )

            # Reduce priority if already studied today
            if completed_today >= 1.5:
                score -= 2

            elif completed_today > 0:
                score -= 1

        # ====================================================
        # REMAINING STUDY HOURS
        # ====================================================

        remaining_hours = get_remaining_hours(
            subject,
            user_id
        )

        # Don't schedule subjects that are already finished
        if remaining_hours <= 0:
            continue

        # Give unfinished subjects a small priority boost
        score += 1

        scored_subjects.append(
            (
                subject,
                score,
                remaining_hours
            )
        )

    # ========================================================
    # SORT BY PRIORITY
    # ========================================================

    scored_subjects.sort(
        key=lambda item: item[1],
        reverse=True
    )

    # ========================================================
    # CREATE SCHEDULE
    # ========================================================

    schedule = []

    remaining_available_hours = float(
        available_hours
    )

    current_time = datetime.combine(
        today,
        datetime.min.time()
    ).replace(
        hour=8,
        minute=0
    )

    break_time = timedelta(
        minutes=15
    )

    while remaining_available_hours > 0:

        scheduled_any = False

        for subject, score, subject_remaining_hours in scored_subjects:

            if remaining_available_hours <= 0:
                break

            if subject_remaining_hours <= 0:
                continue

            study_hours = min(
                1.5,
                remaining_available_hours,
                subject_remaining_hours
            )

            if study_hours <= 0:
                continue

            end_time = (
                current_time +
                timedelta(hours=study_hours)
            )

            schedule.append({
                "subject_id": subject.id,
                "subject": subject.name,
                "hours": study_hours,
                "priority_score": score,
                "start_time": current_time.time(),
                "end_time": end_time.time()
            })

            remaining_available_hours -= study_hours

            current_time = end_time

            if remaining_available_hours > 0:
                current_time += break_time

            scheduled_any = True

        if not scheduled_any:
            break

    return schedule