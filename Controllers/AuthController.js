export const userLogin = async (req,res)=>{
    try {
        const {username,password} = req.body;
        if (!username || !password){
            return res.status(400).json({message: "Please enter all the required fields."})
        }
        const query = "SELECT username from students_tbl WHERE username=?";
    } catch (error) {
        console.error("User Login Error!", error.message);
        res.status(500).json({message: "Server Error!"});
    }
}