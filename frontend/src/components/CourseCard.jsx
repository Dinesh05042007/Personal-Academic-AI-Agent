function CourseCard({ course, onClick }) {
  return (
    <div className="course-card" onClick={onClick}>
      <div className="course-icon">📚</div>
      <h3>{course.name}</h3>
      {course.semester && (
        <p className="course-sem">Semester: {course.semester}</p>
      )}
      <span className="course-link">Open course →</span>
    </div>
  );
}

export default CourseCard;
