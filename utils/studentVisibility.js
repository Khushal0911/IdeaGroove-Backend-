export const activeStudentExistsCondition = (studentColumnRef) => `
  EXISTS (
    SELECT 1
    FROM student_tbl active_student
    WHERE active_student.S_ID = ${studentColumnRef}
      AND active_student.is_Active = 1
  )
`;

export const getStudentStatus = async (executor, studentId) => {
  const [rows] = await executor.query(
    `SELECT S_ID, is_Active
     FROM student_tbl
     WHERE S_ID = ?
     LIMIT 1`,
    [studentId],
  );

  return rows[0] || null;
};

export const isStudentActive = async (executor, studentId) => {
  const student = await getStudentStatus(executor, studentId);
  return Boolean(student && Number(student.is_Active) === 1);
};
