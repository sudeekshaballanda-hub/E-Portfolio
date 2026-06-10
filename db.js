const fs = require('fs').promises;
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'db.json');

const defaultData = {
  profile: {
    name: "Alex Mercer",
    tagline: "B.Tech Computer Science & Engineering Student",
    about: "I am a passionate engineering student focusing on full-stack web technologies, software design, and database systems. I enjoy solving algorithmic challenges and building utility tools that automate workflows.",
    profilePic: "",
    resumeUrl: ""
  },
  socials: {
    github: "https://github.com",
    linkedin: "https://linkedin.com",
    leetcode: "https://leetcode.com",
    twitter: "https://twitter.com",
    email: "alex.mercer@example.com"
  },
  academics: [
    { semester: 1, sgpa: 8.5, cgpa: 8.5, courses: "Calculus, Physics, Introduction to Programming" },
    { semester: 2, sgpa: 8.8, cgpa: 8.65, courses: "Linear Algebra, Chemistry, Data Structures" },
    { semester: 3, sgpa: 9.2, cgpa: 8.83, courses: "Discrete Mathematics, OOP with C++, Digital Logic" },
    { semester: 4, sgpa: 9.0, cgpa: 8.87, courses: "Operating Systems, Computer Networks, Database Systems" },
    { semester: 5, sgpa: 0.0, cgpa: 0.0, courses: "Algorithms, Software Engineering, Cloud Computing" },
    { semester: 6, sgpa: 0.0, cgpa: 0.0, courses: "" },
    { semester: 7, sgpa: 0.0, cgpa: 0.0, courses: "" },
    { semester: 8, sgpa: 0.0, cgpa: 0.0, courses: "" }
  ],
  projects: [
    {
      id: "proj_1",
      title: "IoT Smart Irrigation System",
      description: "An automated watering system driven by soil moisture levels, incorporating an ESP32 microcontroller and a real-time monitoring web interface.",
      link: "https://github.com/example/smart-irrigation",
      image: ""
    },
    {
      id: "proj_2",
      title: "Real-Time Collaborative Code Editor",
      description: "A web application enabling multiple developers to edit code concurrently with integrated chat, powered by Node.js, Express, and WebSockets.",
      link: "https://github.com/example/collaborative-editor",
      image: ""
    }
  ],
  skills: [
    { id: "skill_1", name: "JavaScript / Node.js", category: "Languages & Frameworks", proficiency: 90 },
    { id: "skill_2", name: "React / Vue", category: "Languages & Frameworks", proficiency: 80 },
    { id: "skill_3", name: "SQL & MongoDB", category: "Database & Cloud", proficiency: 75 },
    { id: "skill_4", name: "Python / C++", category: "Languages & Frameworks", proficiency: 85 },
    { id: "skill_5", name: "Docker & CI/CD", category: "Tools & DevOps", proficiency: 70 },
    { id: "skill_6", name: "Git & GitHub", category: "Tools & DevOps", proficiency: 90 }
  ],
  certificates: [
    { id: "cert_1", title: "AWS Certified Solutions Architect", issuer: "Amazon Web Services", date: "Jan 2026", link: "https://aws.amazon.com" },
    { id: "cert_2", title: "Google UX Design Professional Certificate", issuer: "Google / Coursera", date: "Nov 2025", link: "https://coursera.org" }
  ],
  achievements: [
    { id: "ach_1", title: "Smart India Hackathon 2025 Winner", description: "Secured 1st place in the Smart Education track for developing an AI-driven study planner.", date: "Dec 2025" },
    { id: "ach_2", title: "Academic Excellence Award", description: "Awarded top performer in the Department of CSE with a CGPA of 9.6/10.0.", date: "July 2025" }
  ],
  blogs: [
    {
      id: "blog_1",
      title: "Why SQLite & JSON Are Perfect for Rapid Prototyping",
      excerpt: "Discover the advantages of local embedded file-based databases for projects, portfolios, and local utility tools where cloud server configurations are overkill.",
      content: "When starting a new project, setting up databases can be tedious. A local JSON or SQLite database offers a zero-configuration, super-fast environment to test your models and APIs. In this post, we'll explore how you can write clean database code that is ready for easy migration later, saving you configuration headaches and allowing you to focus purely on business logic and UI.",
      date: "2026-06-01"
    }
  ],
  messages: []
};

let dbCache = null;
let writeQueue = Promise.resolve();

async function init() {
  try {
    await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
    try {
      const dataStr = await fs.readFile(DB_PATH, 'utf8');
      dbCache = JSON.parse(dataStr);
      
      // Upgrade schema in-place if missing fields
      let upgraded = false;
      if (!dbCache.socials) {
        dbCache.socials = defaultData.socials;
        upgraded = true;
      }
      if (!dbCache.academics) {
        dbCache.academics = defaultData.academics;
        upgraded = true;
      }
      if (upgraded) {
        await fs.writeFile(DB_PATH, JSON.stringify(dbCache, null, 2), 'utf8');
      }
    } catch (err) {
      // file doesn't exist or is invalid JSON, initialize with default data
      dbCache = defaultData;
      await fs.writeFile(DB_PATH, JSON.stringify(defaultData, null, 2), 'utf8');
    }
  } catch (err) {
    console.error("Failed to initialize database:", err);
    dbCache = defaultData;
  }
}

async function getDb() {
  if (!dbCache) {
    await init();
  }
  return dbCache;
}

async function saveDb() {
  writeQueue = writeQueue.then(async () => {
    try {
      await fs.writeFile(DB_PATH, JSON.stringify(dbCache, null, 2), 'utf8');
    } catch (err) {
      console.error("Error writing to database:", err);
    }
  });
  return writeQueue;
}

module.exports = {
  // Profile
  async getProfile() {
    const db = await getDb();
    return db.profile;
  },
  async updateProfile(profileData) {
    const db = await getDb();
    db.profile = { ...db.profile, ...profileData };
    await saveDb();
    return db.profile;
  },

  // Socials
  async getSocials() {
    const db = await getDb();
    return db.socials || defaultData.socials;
  },
  async updateSocials(socialsData) {
    const db = await getDb();
    db.socials = { ...(db.socials || defaultData.socials), ...socialsData };
    await saveDb();
    return db.socials;
  },

  // Academics
  async getAcademics() {
    const db = await getDb();
    return db.academics || defaultData.academics;
  },
  async updateSemester(semNum, data) {
    const db = await getDb();
    if (!db.academics) db.academics = defaultData.academics;
    const index = db.academics.findIndex(s => s.semester === parseInt(semNum, 10));
    if (index !== -1) {
      db.academics[index] = { 
        ...db.academics[index], 
        sgpa: parseFloat(data.sgpa) || 0.0, 
        cgpa: parseFloat(data.cgpa) || 0.0, 
        courses: data.courses || "" 
      };
      await saveDb();
      return db.academics[index];
    }
    return null;
  },

  // Projects CRUD
  async getProjects() {
    const db = await getDb();
    return db.projects || [];
  },
  async addProject(project) {
    const db = await getDb();
    project.id = 'proj_' + Date.now();
    if (!db.projects) db.projects = [];
    db.projects.push(project);
    await saveDb();
    return project;
  },
  async updateProject(id, updatedData) {
    const db = await getDb();
    if (!db.projects) db.projects = [];
    const index = db.projects.findIndex(p => p.id === id);
    if (index !== -1) {
      db.projects[index] = { ...db.projects[index], ...updatedData };
      await saveDb();
      return db.projects[index];
    }
    return null;
  },
  async deleteProject(id) {
    const db = await getDb();
    if (!db.projects) db.projects = [];
    const index = db.projects.findIndex(p => p.id === id);
    if (index !== -1) {
      const deleted = db.projects.splice(index, 1)[0];
      await saveDb();
      return deleted;
    }
    return null;
  },

  // Skills CRUD
  async getSkills() {
    const db = await getDb();
    return db.skills || [];
  },
  async addSkill(skill) {
    const db = await getDb();
    skill.id = 'skill_' + Date.now();
    if (!db.skills) db.skills = [];
    db.skills.push(skill);
    await saveDb();
    return skill;
  },
  async updateSkill(id, updatedData) {
    const db = await getDb();
    if (!db.skills) db.skills = [];
    const index = db.skills.findIndex(s => s.id === id);
    if (index !== -1) {
      db.skills[index] = { 
        ...db.skills[index], 
        ...updatedData,
        proficiency: parseInt(updatedData.proficiency, 10) || 100
      };
      await saveDb();
      return db.skills[index];
    }
    return null;
  },
  async deleteSkill(id) {
    const db = await getDb();
    if (!db.skills) db.skills = [];
    const index = db.skills.findIndex(s => s.id === id);
    if (index !== -1) {
      const deleted = db.skills.splice(index, 1)[0];
      await saveDb();
      return deleted;
    }
    return null;
  },

  // Certificates CRUD
  async getCertificates() {
    const db = await getDb();
    return db.certificates || [];
  },
  async addCertificate(cert) {
    const db = await getDb();
    cert.id = 'cert_' + Date.now();
    if (!db.certificates) db.certificates = [];
    db.certificates.push(cert);
    await saveDb();
    return cert;
  },
  async updateCertificate(id, updatedData) {
    const db = await getDb();
    if (!db.certificates) db.certificates = [];
    const index = db.certificates.findIndex(c => c.id === id);
    if (index !== -1) {
      db.certificates[index] = { ...db.certificates[index], ...updatedData };
      await saveDb();
      return db.certificates[index];
    }
    return null;
  },
  async deleteCertificate(id) {
    const db = await getDb();
    if (!db.certificates) db.certificates = [];
    const index = db.certificates.findIndex(c => c.id === id);
    if (index !== -1) {
      const deleted = db.certificates.splice(index, 1)[0];
      await saveDb();
      return deleted;
    }
    return null;
  },

  // Achievements CRUD
  async getAchievements() {
    const db = await getDb();
    return db.achievements || [];
  },
  async addAchievement(ach) {
    const db = await getDb();
    ach.id = 'ach_' + Date.now();
    if (!db.achievements) db.achievements = [];
    db.achievements.push(ach);
    await saveDb();
    return ach;
  },
  async updateAchievement(id, updatedData) {
    const db = await getDb();
    if (!db.achievements) db.achievements = [];
    const index = db.achievements.findIndex(a => a.id === id);
    if (index !== -1) {
      db.achievements[index] = { ...db.achievements[index], ...updatedData };
      await saveDb();
      return db.achievements[index];
    }
    return null;
  },
  async deleteAchievement(id) {
    const db = await getDb();
    if (!db.achievements) db.achievements = [];
    const index = db.achievements.findIndex(a => a.id === id);
    if (index !== -1) {
      const deleted = db.achievements.splice(index, 1)[0];
      await saveDb();
      return deleted;
    }
    return null;
  },

  // Blogs CRUD
  async getBlogs() {
    const db = await getDb();
    return db.blogs || [];
  },
  async addBlog(blog) {
    const db = await getDb();
    blog.id = 'blog_' + Date.now();
    blog.date = new Date().toISOString().split('T')[0];
    if (!db.blogs) db.blogs = [];
    db.blogs.push(blog);
    await saveDb();
    return blog;
  },
  async updateBlog(id, updatedData) {
    const db = await getDb();
    if (!db.blogs) db.blogs = [];
    const index = db.blogs.findIndex(b => b.id === id);
    if (index !== -1) {
      db.blogs[index] = { ...db.blogs[index], ...updatedData };
      await saveDb();
      return db.blogs[index];
    }
    return null;
  },
  async deleteBlog(id) {
    const db = await getDb();
    if (!db.blogs) db.blogs = [];
    const index = db.blogs.findIndex(b => b.id === id);
    if (index !== -1) {
      const deleted = db.blogs.splice(index, 1)[0];
      await saveDb();
      return deleted;
    }
    return null;
  },

  // Messages (Contact form submissions)
  async getMessages() {
    const db = await getDb();
    return db.messages || [];
  },
  async addMessage(msg) {
    const db = await getDb();
    msg.id = 'msg_' + Date.now();
    msg.date = new Date().toISOString();
    if (!db.messages) db.messages = [];
    db.messages.push(msg);
    await saveDb();
    return msg;
  },
  async deleteMessage(id) {
    const db = await getDb();
    if (!db.messages) db.messages = [];
    const index = db.messages.findIndex(m => m.id === id);
    if (index !== -1) {
      const deleted = db.messages.splice(index, 1)[0];
      await saveDb();
      return deleted;
    }
    return null;
  },

  // Helper to fetch everything in one call
  async getAllData() {
    const db = await getDb();
    return {
      profile: db.profile,
      socials: db.socials || defaultData.socials,
      academics: db.academics || defaultData.academics,
      projects: db.projects || [],
      skills: db.skills || [],
      certificates: db.certificates || [],
      achievements: db.achievements || [],
      blogs: db.blogs || []
    };
  }
};
