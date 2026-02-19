
export const handleHealth = async (req, res) => {
  res.json({ 
    status: "healthy", 
    version: "6.0.0", 
    timestamp: new Date().toISOString() 
  });
};
