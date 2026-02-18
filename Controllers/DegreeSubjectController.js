import db from "../config/db.js";

export const allDegreeSubject = async(req,res)=>{
    try{
        const allDegreeSubjectQuery = `select 
        ds.*,
        s.subject_name,
        d.degree_name 
        from degree_subject_mapping_tbl ds 
        left join subject_Tbl s ON s.subject_id = ds.subject_id
        left join degree_tbl d
        ON d.degree_id = ds.degree_id`;

        const degreeSubjectData = await db.query(allDegreeSubjectQuery);

        res.status(201).json({
            status:true,
            degreeSubject : degreeSubjectData,
        })
    }catch(err){
        console.error("Unable to fetch Degree Subject : ",err);
        res.status(500).json({
            error: "Failed to fetch Degree subject",
        });
    }
};