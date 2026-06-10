const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const SALT_ROUNDS = 10;
const HASHED_PASSWORD = bcrypt.hashSync(ADMIN_PASSWORD, SALT_ROUNDS);

// Express middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
  secret: 'engineering-portfolio-secret-key-12345',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 1 day session
}));

// Serve static files from /public
app.use(express.static(path.join(__dirname, 'public')));

// Configure Multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, 'public', 'uploads');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'resume') {
      if (file.mimetype === 'application/pdf') {
        cb(null, true);
      } else {
        cb(new Error('Only PDF format allowed for resumes!'));
      }
    } else if (file.fieldname === 'projectImage' || file.fieldname === 'profileImage') {
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Only image files allowed!'));
      }
    } else {
      cb(null, true);
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Auth check middleware
function requireAuth(req, res, next) {
  if (req.session && req.session.isAdmin) {
    return next();
  }
  res.status(401).json({ error: 'Unauthorized. Please log in.' });
}

// --- PUBLIC PORTFOLIO APIS ---

app.get('/api/portfolio', async (req, res) => {
  try {
    const data = await db.getAllData();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch portfolio data' });
  }
});

app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;
    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Name, email, and message are required' });
    }
    const newMessage = await db.addMessage({ name, email, subject: subject || 'General Query', message });
    res.json({ success: true, message: 'Message sent successfully!', data: newMessage });
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit contact message' });
  }
});

// --- ADMIN AUTH APIS ---

app.post('/api/auth/login', (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ error: 'Password is required' });
  }
  const matches = bcrypt.compareSync(password, HASHED_PASSWORD);
  if (matches) {
    req.session.isAdmin = true;
    res.json({ success: true, message: 'Logged in successfully' });
  } else {
    res.status(401).json({ error: 'Invalid password' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ success: true, message: 'Logged out successfully' });
  });
});

app.get('/api/admin/check', (req, res) => {
  if (req.session && req.session.isAdmin) {
    res.json({ authenticated: true });
  } else {
    res.json({ authenticated: false });
  }
});

// --- PROTECTED ADMIN APIS ---

// Update Profile Core Details
app.post('/api/admin/profile', requireAuth, upload.single('profileImage'), async (req, res) => {
  try {
    const { name, tagline, about } = req.body;
    const profileUpdate = {};
    if (name !== undefined) profileUpdate.name = name;
    if (tagline !== undefined) profileUpdate.tagline = tagline;
    if (about !== undefined) profileUpdate.about = about;
    
    if (req.file) {
      profileUpdate.profilePic = `/uploads/${req.file.filename}`;
    }

    const updated = await db.updateProfile(profileUpdate);
    res.json({ success: true, message: 'Profile updated successfully!', data: updated });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to update profile' });
  }
});

// Upload Resume PDF
app.post('/api/admin/resume', requireAuth, upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Please upload a PDF file' });
    }
    const resumeUrl = `/uploads/${req.file.filename}`;
    await db.updateProfile({ resumeUrl });
    res.json({ success: true, message: 'Resume uploaded successfully!', resumeUrl });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to upload resume' });
  }
});

// Update Social Links (PUT)
app.put('/api/admin/socials', requireAuth, async (req, res) => {
  try {
    const { github, linkedin, leetcode, twitter, email } = req.body;
    const updated = await db.updateSocials({ github, linkedin, leetcode, twitter, email });
    res.json({ success: true, message: 'Social links updated successfully!', data: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update social links' });
  }
});

// Update BTech Academics Semester (PUT)
app.put('/api/admin/academics/:sem', requireAuth, async (req, res) => {
  try {
    const { sem } = req.params;
    const { sgpa, cgpa, courses } = req.body;
    
    const updated = await db.updateSemester(sem, { sgpa, cgpa, courses });
    if (updated) {
      res.json({ success: true, message: `Semester ${sem} grades updated successfully!`, data: updated });
    } else {
      res.status(404).json({ error: 'Semester not found' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to update semester grades' });
  }
});

// Create Project (POST)
app.post('/api/admin/projects', requireAuth, upload.single('projectImage'), async (req, res) => {
  try {
    const { title, description, link } = req.body;
    if (!title || !description) {
      return res.status(400).json({ error: 'Title and description are required' });
    }

    const projectImage = req.file ? `/uploads/${req.file.filename}` : '';
    const newProj = await db.addProject({
      title,
      description,
      link: link || '',
      image: projectImage
    });

    res.json({ success: true, message: 'Project added successfully!', data: newProj });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to add project' });
  }
});

// Edit Project (PUT)
app.put('/api/admin/projects/:id', requireAuth, upload.single('projectImage'), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, link } = req.body;
    
    if (!title || !description) {
      return res.status(400).json({ error: 'Title and description are required' });
    }

    const projects = await db.getProjects();
    const existing = projects.find(p => p.id === id);
    if (!existing) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const updatedData = {
      title,
      description,
      link: link || ''
    };

    if (req.file) {
      updatedData.image = `/uploads/${req.file.filename}`;
      // delete old image if it exists
      if (existing.image) {
        const oldImgPath = path.join(__dirname, 'public', existing.image);
        if (fs.existsSync(oldImgPath)) {
          fs.unlinkSync(oldImgPath);
        }
      }
    }

    const updated = await db.updateProject(id, updatedData);
    res.json({ success: true, message: 'Project updated successfully!', data: updated });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to update project' });
  }
});

// Delete Project (DELETE /api/admin/projects/:id)
app.delete('/api/admin/projects/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await db.deleteProject(id);
    if (deleted) {
      if (deleted.image) {
        const imgPath = path.join(__dirname, 'public', deleted.image);
        if (fs.existsSync(imgPath)) {
          fs.unlinkSync(imgPath);
        }
      }
      return res.json({ success: true, message: 'Project deleted successfully!' });
    }
    res.status(404).json({ error: 'Project not found' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

// Create Skill (POST)
app.post('/api/admin/skills', requireAuth, async (req, res) => {
  try {
    const { name, category, proficiency } = req.body;
    if (!name || !category) {
      return res.status(400).json({ error: 'Skill name and Category are required' });
    }
    const newSkill = await db.addSkill({ name, category, proficiency });
    res.json({ success: true, message: 'Skill added successfully!', data: newSkill });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add skill' });
  }
});

// Edit Skill (PUT)
app.put('/api/admin/skills/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, proficiency } = req.body;
    if (!name || !category) {
      return res.status(400).json({ error: 'Skill name and Category are required' });
    }
    const updated = await db.updateSkill(id, { name, category, proficiency });
    if (updated) {
      res.json({ success: true, message: 'Skill updated successfully!', data: updated });
    } else {
      res.status(404).json({ error: 'Skill not found' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to update skill' });
  }
});

// Delete Skill (DELETE)
app.delete('/api/admin/skills/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await db.deleteSkill(id);
    if (deleted) return res.json({ success: true, message: 'Skill deleted successfully!' });
    res.status(404).json({ error: 'Skill not found' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete skill' });
  }
});

// Create Certificate (POST)
app.post('/api/admin/certificates', requireAuth, async (req, res) => {
  try {
    const { title, issuer, date, link } = req.body;
    if (!title || !issuer || !date) {
      return res.status(400).json({ error: 'Title, Issuer, and Date are required' });
    }
    const newCert = await db.addCertificate({ title, issuer, date, link: link || '' });
    res.json({ success: true, message: 'Certificate added successfully!', data: newCert });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add certificate' });
  }
});

// Edit Certificate (PUT)
app.put('/api/admin/certificates/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, issuer, date, link } = req.body;
    if (!title || !issuer || !date) {
      return res.status(400).json({ error: 'Title, Issuer, and Date are required' });
    }
    const updated = await db.updateCertificate(id, { title, issuer, date, link: link || '' });
    if (updated) {
      res.json({ success: true, message: 'Certificate updated successfully!', data: updated });
    } else {
      res.status(404).json({ error: 'Certificate not found' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to update certificate' });
  }
});

// Delete Certificate (DELETE)
app.delete('/api/admin/certificates/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await db.deleteCertificate(id);
    if (deleted) return res.json({ success: true, message: 'Certificate deleted successfully!' });
    res.status(404).json({ error: 'Certificate not found' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete certificate' });
  }
});

// Create Achievement (POST)
app.post('/api/admin/achievements', requireAuth, async (req, res) => {
  try {
    const { title, description, date } = req.body;
    if (!title || !description || !date) {
      return res.status(400).json({ error: 'Title, Description, and Date are required' });
    }
    const newAch = await db.addAchievement({ title, description, date });
    res.json({ success: true, message: 'Achievement added successfully!', data: newAch });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add achievement' });
  }
});

// Edit Achievement (PUT)
app.put('/api/admin/achievements/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, date } = req.body;
    if (!title || !description || !date) {
      return res.status(400).json({ error: 'Title, Description, and Date are required' });
    }
    const updated = await db.updateAchievement(id, { title, description, date });
    if (updated) {
      res.json({ success: true, message: 'Achievement updated successfully!', data: updated });
    } else {
      res.status(404).json({ error: 'Achievement not found' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to update achievement' });
  }
});

// Delete Achievement (DELETE)
app.delete('/api/admin/achievements/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await db.deleteAchievement(id);
    if (deleted) return res.json({ success: true, message: 'Achievement deleted successfully!' });
    res.status(404).json({ error: 'Achievement not found' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete achievement' });
  }
});

// Create Blog (POST)
app.post('/api/admin/blogs', requireAuth, async (req, res) => {
  try {
    const { title, excerpt, content } = req.body;
    if (!title || !excerpt || !content) {
      return res.status(400).json({ error: 'Title, Excerpt, and Content are required' });
    }
    const newBlog = await db.addBlog({ title, excerpt, content });
    res.json({ success: true, message: 'Blog post added successfully!', data: newBlog });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add blog post' });
  }
});

// Edit Blog (PUT)
app.put('/api/admin/blogs/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, excerpt, content } = req.body;
    if (!title || !excerpt || !content) {
      return res.status(400).json({ error: 'Title, Excerpt, and Content are required' });
    }
    const updated = await db.updateBlog(id, { title, excerpt, content });
    if (updated) {
      res.json({ success: true, message: 'Blog post updated successfully!', data: updated });
    } else {
      res.status(404).json({ error: 'Blog post not found' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to update blog post' });
  }
});

// Delete Blog (DELETE)
app.delete('/api/admin/blogs/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await db.deleteBlog(id);
    if (deleted) return res.json({ success: true, message: 'Blog post deleted successfully!' });
    res.status(404).json({ error: 'Blog post not found' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete blog post' });
  }
});

// View Contact Messages
app.get('/api/admin/messages', requireAuth, async (req, res) => {
  try {
    const messages = await db.getMessages();
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve messages' });
  }
});

// Delete Message
app.post('/api/admin/messages/delete', requireAuth, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'Message ID is required' });
    const deleted = await db.deleteMessage(id);
    if (deleted) return res.json({ success: true, message: 'Message deleted successfully!' });
    res.status(404).json({ error: 'Message not found' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

// Multer & General Error Handlers
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: `File upload error: ${err.message}` });
  }
  if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
});

// Start Express App
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
