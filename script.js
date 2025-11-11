// === DOM Elements ===
const newChatBtn = document.getElementById("newChatBtn");
const messageInput = document.getElementById("textInput");
const chatOutput = document.querySelector(".messages-container");
const chatHistory = document.getElementById("chatHistory");
const talkButton = document.getElementById("talkButton");
const listenButton = document.getElementById("listenButton");
const submitText = document.getElementById("submitText");
const darkModeToggle = document.getElementById("darkModeToggle");
const exportBtn = document.getElementById("exportBtn");
const sidebarToggle = document.getElementById("sidebarToggle");
const container = document.querySelector(".container");

// === Speech recognition & synthesis ===
let isListening = false;
const synth = window.speechSynthesis;
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.lang = 'en-US';
  recognition.interimResults = false;
}

// === Chat sessions ===
let currentSessionId = null;
let sessions = JSON.parse(localStorage.getItem("chatSessions")) || {};
let activeSessionElement = null;

// === Initialize ===
function init() {
  loadChatHistory();
  showWelcomeMessage();

  newChatBtn.addEventListener('click', createNewChat);

  // Auto-resize textarea
  messageInput.addEventListener('input', () => {
    messageInput.style.height = 'auto';
    messageInput.style.height = (messageInput.scrollHeight) + 'px';
  });

  messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && messageInput.value.trim() !== '') {
      e.preventDefault();
      sendMessage(messageInput.value);
      messageInput.value = '';
      messageInput.style.height = 'auto'; // Reset height
    }
  });

  submitText.addEventListener('click', (e) => {
    e.preventDefault();
    if (messageInput.value.trim() !== '') {
      sendMessage(messageInput.value);
      messageInput.value = '';
      messageInput.style.height = 'auto'; // Reset height
    }
  });
  
  // Update send button state based on input
  messageInput.addEventListener('input', () => {
    const hasText = messageInput.value.trim() !== '';
    submitText.disabled = !hasText;
    submitText.style.opacity = hasText ? '1' : '';
  });
  
  // Initialize send button state
  submitText.disabled = true;
  submitText.style.opacity = '';

  talkButton.addEventListener('click', (e) => {
    e.preventDefault();
    const lastMessage = chatOutput.querySelector('.message.assistant:last-child .message-content');
    if (lastMessage) {
      speak(lastMessage.textContent);
    } else {
      speak("Hi, how can I help you?");
    }
  });

  listenButton.addEventListener('click', (e) => {
    e.preventDefault();
    if (!recognition) {
      alert("Speech Recognition not supported in this browser.");
      return;
    }

    if (isListening) {
      recognition.stop();
      listenButton.classList.remove('listening');
      isListening = false;
      return;
    }

    try {
      recognition.start();
      listenButton.classList.add('listening');
      isListening = true;

      recognition.onresult = (e) => {
        const transcript = e.results[0][0].transcript;
        messageInput.value = transcript;
        listenButton.classList.remove('listening');
        isListening = false;
        // Trigger input event to update send button
        messageInput.dispatchEvent(new Event('input'));
      };

      recognition.onerror = (e) => {
        console.error('Speech recognition error:', e.error);
        listenButton.classList.remove('listening');
        isListening = false;
      };

      recognition.onend = () => {
        listenButton.classList.remove('listening');
        isListening = false;
      };
    } catch (error) {
      console.error('Error starting speech recognition:', error);
      listenButton.classList.remove('listening');
      isListening = false;
    }
  });

  darkModeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark');
    // The text is now handled by CSS, but if you need logic:
    // const isDark = document.body.classList.contains('dark');
    // const textSpan = darkModeToggle.querySelector('span');
    // if (textSpan) {
    //   textSpan.textContent = isDark ? 'Light mode' : 'Dark mode';
    // }
  });

  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(sessions, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "altaf_chat_history.json";
      link.click();
    });
  }
  
  // Sidebar toggle functionality
  sidebarToggle.addEventListener('click', () => {
    if (window.innerWidth <= 768) {
      container.classList.toggle('sidebar-open');
    } else {
      container.classList.toggle('sidebar-collapsed');
    }
  });
}

// === Chat Management ===
function createNewChat() {
  currentSessionId = `chat-${Date.now()}`;
  sessions[currentSessionId] = {
    messages: [],
    title: 'New chat',
    timestamp: new Date().toISOString()
  };
  
  if (activeSessionElement) {
    activeSessionElement.classList.remove('active');
  }
  
  showWelcomeMessage();
  addChatToHistory(currentSessionId);

  if (window.innerWidth <= 768) {
    container.classList.remove('sidebar-open');
  }

  saveSessions();
}

function loadChatHistory() {
  chatHistory.innerHTML = '';
  
  // Sort sessions by timestamp, newest first
  const sortedSessions = Object.entries(sessions)
    .sort(([,a], [,b]) => new Date(b.timestamp) - new Date(a.timestamp));
  
  // Append sorted sessions to the history container
  sortedSessions.forEach(([sessionId, session]) => {
    const chatItem = document.createElement('div');
    chatItem.className = 'chat-item';
    chatItem.textContent = session.title || 'New chat';
    chatItem.dataset.sessionId = sessionId;
    
    chatItem.addEventListener('click', () => switchToChat(sessionId, chatItem));
    if (window.innerWidth <= 768) {
      chatItem.addEventListener('click', () => container.classList.remove('sidebar-open'));
    }
    chatHistory.appendChild(chatItem);
  });
}

function addChatToHistory(sessionId, title = 'New chat') {
  const chatItem = document.createElement('div');
  chatItem.className = 'chat-item';
  chatItem.textContent = title;
  chatItem.dataset.sessionId = sessionId;
  
  chatItem.addEventListener('click', () => switchToChat(sessionId, chatItem));

  if (window.innerWidth <= 768) {
    chatItem.addEventListener('click', () => container.classList.remove('sidebar-open'));
  }

  chatHistory.insertBefore(chatItem, chatHistory.firstChild);
  
  if (sessionId === currentSessionId) {
    switchToChat(sessionId, chatItem);
  }
}

function switchToChat(sessionId, element) {
  if (activeSessionElement) {
    activeSessionElement.classList.remove('active');
  }
  
  activeSessionElement = element;
  element.classList.add('active');
  currentSessionId = sessionId;
  
  displayChatMessages(sessionId);
}

function displayChatMessages(sessionId) {
  const session = sessions[sessionId];
  if (!session) return;
  
  chatOutput.innerHTML = '';
  
  if (session.messages.length === 0) {
    showWelcomeMessage();
    return;
  }
  
  session.messages.forEach(msg => {
    displayMessage(msg.content, msg.sender);
  });
}

function showWelcomeMessage() {
  chatOutput.innerHTML = `
    <div class="welcome-message">
      <h1>How can I help you today?</h1>
    </div>
  `;
}

function updateChatTitle(sessionId, firstMessage) {
  const title = firstMessage.length > 30 ? firstMessage.substring(0, 30) + '...' : firstMessage;
  sessions[sessionId].title = title;
  
  const chatItem = document.querySelector(`[data-session-id="${sessionId}"]`);
  if (chatItem) {
    chatItem.textContent = title;
  }
  
  saveSessions();
}

// === Message Functions ===
function addMessage(content, sender = 'user') {
  if (!currentSessionId) {
    createNewChat();
  }
  
  const messageData = { sender, content, time: new Date().toISOString() };
  
  if (!sessions[currentSessionId].messages) {
    sessions[currentSessionId].messages = [];
  }
  
  sessions[currentSessionId].messages.push(messageData);
  
  // Update chat title with first user message
  if (sender === 'user' && sessions[currentSessionId].messages.filter(m => m.sender === 'user').length === 1) {
    updateChatTitle(currentSessionId, content);
  }
  
  displayMessage(content, sender);
  saveSessions();
}

function displayMessage(content, sender) {
  // Remove welcome message if it exists
  const welcomeMsg = chatOutput.querySelector('.welcome-message');
  if (welcomeMsg) {
    welcomeMsg.remove();
  }
  
  const messageEl = document.createElement('div');
  messageEl.className = `message ${sender}`;
  
  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  avatar.textContent = sender === 'user' ? 'U' : 'AI';
  
  const messageContent = document.createElement('div');
  messageContent.className = 'message-content';
  
  if (sender === 'assistant') {
    messageContent.innerHTML = formatAssistantMessage(content);
  } else {
    messageContent.textContent = content;
  }
  
  messageEl.appendChild(avatar);
  messageEl.appendChild(messageContent);
  
  chatOutput.appendChild(messageEl);
  chatOutput.scrollTop = chatOutput.scrollHeight;
}

function formatAssistantMessage(content) {
  // Format main headings
  content = content.replace(/^# (.+)$/gm, '<h2 class="main-heading">$1</h2>');
  
  // Format sub headings
  content = content.replace(/^## (.+)$/gm, '<h3 class="sub-heading">$1</h3>');
  
  // Format bold text
  content = content.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');

  // Format links (http, https)
  content = content.replace(/(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))/g, '<a href="$3" target="_blank">$2</a>');
  
  // Split content into lines for better processing
  let lines = content.split('\n');
  let processedLines = [];
  let inList = false;
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    
    if (line === '') {
      if (inList) {
        processedLines.push('</ul>');
        inList = false;
      }
      processedLines.push('<br>');
    } else if (line.match(/^[•\-\*]\s+/)) {
      if (!inList) {
        processedLines.push('<ul>');
        inList = true;
      }
      processedLines.push('<li>' + line.replace(/^[•\-\*]\s+/, '') + '</li>');
    } else if (line.match(/^\d+\.\s+/)) {
      if (!inList) {
        processedLines.push('<ol>');
        inList = true;
      }
      processedLines.push('<li>' + line.replace(/^\d+\.\s+/, '') + '</li>');
    } else {
      if (inList) {
        processedLines.push('</ul>');
        inList = false;
      }
      if (line && !line.includes('<h2') && !line.includes('<h3')) {
        processedLines.push('<p>' + line + '</p>');
      } else {
        processedLines.push(line);
      }
    }
  }
  
  if (inList) {
    processedLines.push('</ul>');
  }
  
  return processedLines.join('');
}

function sendMessage(message) {
  addMessage(message, 'user');
  processTextCommand(message);
}

function speak(text) {
  if (synth.speaking) synth.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  synth.speak(utter);
}

// === JNTU PDFs ===
function openPDF(subject) {
  let pdfLinks = {
    "cse": "https://jntuh.ac.in/uploads/academic_regulations/R22-B.Tech-Syllabus-CSE.pdf",
    "ece": "https://jntuh.ac.in/uploads/academic_regulations/R22-B.Tech-Syllabus-ECE.pdf",
    "mech": "https://jntuh.ac.in/uploads/academic_regulations/R22-B.Tech-Syllabus-MECH.pdf",
    "civil": "https://jntuh.ac.in/uploads/academic_regulations/R22-B.Tech-Syllabus-CIVIL.pdf",
    "it": "https://jntuh.ac.in/uploads/academic_regulations/R22-B.Tech-Syllabus-IT.pdf"
  };

  if (pdfLinks[subject.toLowerCase()]) {
    window.open(pdfLinks[subject.toLowerCase()], "_blank");
    speak(`Opening ${subject.toUpperCase()} syllabus PDF from JNTU`);
    addMessage(`📖 Opening ${subject.toUpperCase()} syllabus PDF...`, "assistant");
  } else {
    speak("Sorry, I don't have that subject's PDF.");
    addMessage("⚠️ PDF for this subject is not available.", "assistant");
  }
}

// === Video Embedding ===
function embedYouTubeVideo(videoId, title) {
  const container = document.createElement("div");
  container.className = "video-container";

  const heading = document.createElement("h4");
  heading.textContent = `🎬 ${title}`;
  heading.style.marginBottom = "15px";
  container.appendChild(heading);

  // Create video thumbnail and play button
  const videoWrapper = document.createElement("div");
  videoWrapper.className = "video-wrapper";
  videoWrapper.style.cssText = `
    position: relative;
    background: #000;
    border-radius: 12px;
    overflow: hidden;
    cursor: pointer;
    transition: transform 0.2s;
  `;
  
  const thumbnail = document.createElement("img");
  thumbnail.src = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
  thumbnail.alt = title;
  thumbnail.style.cssText = `
    width: 100%;
    height: 315px;
    object-fit: cover;
    display: block;
  `;
  
  const playButton = document.createElement("div");
  playButton.innerHTML = "▶️";
  playButton.style.cssText = `
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 60px;
    color: white;
    text-shadow: 0 0 10px rgba(0,0,0,0.8);
    pointer-events: none;
  `;
  
  const overlay = document.createElement("div");
  overlay.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s;
  `;
  
  videoWrapper.appendChild(thumbnail);
  overlay.appendChild(playButton);
  videoWrapper.appendChild(overlay);
  
  // Add hover effect
  videoWrapper.addEventListener('mouseenter', () => {
    videoWrapper.style.transform = 'scale(1.02)';
    overlay.style.background = 'rgba(0,0,0,0.1)';
  });
  
  videoWrapper.addEventListener('mouseleave', () => {
    videoWrapper.style.transform = 'scale(1)';
    overlay.style.background = 'rgba(0,0,0,0.3)';
  });
  
  // Click to play video
  videoWrapper.addEventListener('click', () => {
    window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank');
  });
  
  const description = document.createElement("p");
  description.textContent = "Click to watch on YouTube";
  
  container.appendChild(videoWrapper);
  container.appendChild(description);
  chatOutput.appendChild(container);
  chatOutput.scrollTop = chatOutput.scrollHeight;
}

// === Video Library ===
const videoLibrary = {
  "python": { id: "rfscVS0vtbw", title: "Python Full Course for Beginners" },
  "java": { id: "eIrMbAQSU34", title: "Java Full Course for Beginners" },
  "c": { id: "KJgsSFOSQv0", title: "C Programming Full Course for Beginners" },
  "c++": { id: "8jLOx1hD3_o", title: "C++ Full Course for Beginners" },
  "javascript": { id: "W6NZfCO5SIk", title: "JavaScript Full Course for Beginners" },
  "sql": { id: "HXV3zeQKqGY", title: "SQL Full Course for Beginners" },
  "html": { id: "kUMe1FH4CHE", title: "HTML Full Course for Beginners" },
  "css": { id: "1PnVor36_40", title: "CSS Full Course for Beginners" }
};

function checkAndPlayVideo(cmd) {
  for (let key in videoLibrary) {
    if (
      cmd.includes(`best ${key}`) ||
      cmd.includes(`${key} course`) ||
      cmd.includes(`${key} tutorial`) ||
      cmd.includes(`learn ${key}`)
    ) {
      let { id, title } = videoLibrary[key];
      embedYouTubeVideo(id, title);
      speak(`Here's the best ${key.toUpperCase()} learning video, playing now.`);
      return true;
    }
  }
  return false;
}

// === Video Search Library ===
const videoSearchLibrary = {
  "comedy": [
    { id: "9bZkp7q19f0", title: "Best Comedy Compilation" },
    { id: "hFZFjoX2cGg", title: "Funny Moments Collection" },
    { id: "y6120QOlsfU", title: "Comedy Gold" }
  ],
  "music": [
    { id: "kJQP7kiw5Fk", title: "Best Music Mix" },
    { id: "fJ9rUzIMcZQ", title: "Top Hits Playlist" },
    { id: "ktvTqknDobU", title: "Music Collection" }
  ],
  "funny": [
    { id: "9bZkp7q19f0", title: "Hilarious Compilation" },
    { id: "hFZFjoX2cGg", title: "Funny Videos" },
    { id: "y6120QOlsfU", title: "Comedy Central" }
  ],
  "entertainment": [
    { id: "kJQP7kiw5Fk", title: "Entertainment Tonight" },
    { id: "fJ9rUzIMcZQ", title: "Fun Videos" },
    { id: "ktvTqknDobU", title: "Best Entertainment" }
  ],
  "movie": [
    { id: "9bZkp7q19f0", title: "Movie Trailers" },
    { id: "hFZFjoX2cGg", title: "Film Highlights" },
    { id: "y6120QOlsfU", title: "Cinema Collection" }
  ],
  "dance": [
    { id: "kJQP7kiw5Fk", title: "Best Dance Moves" },
    { id: "fJ9rUzIMcZQ", title: "Dance Compilation" },
    { id: "ktvTqknDobU", title: "Dancing Videos" }
  ],
  "sports": [
    { id: "9bZkp7q19f0", title: "Sports Highlights" },
    { id: "hFZFjoX2cGg", title: "Best Sports Moments" },
    { id: "y6120QOlsfU", title: "Athletic Compilation" }
  ],
  "gaming": [
    { id: "kJQP7kiw5Fk", title: "Gaming Highlights" },
    { id: "fJ9rUzIMcZQ", title: "Best Gaming Moments" },
    { id: "ktvTqknDobU", title: "Game Reviews" }
  ]
};

function searchAndPlayVideo(query) {
  const normalizedQuery = query.toLowerCase().trim();
  
  // Remove common words
  const cleanQuery = normalizedQuery.replace(/video|watch|play|show|me|best|good|funny/g, "").trim();
  
  // Search in video library
  for (const [category, videos] of Object.entries(videoSearchLibrary)) {
    if (normalizedQuery.includes(category) || cleanQuery.includes(category)) {
      const randomVideo = videos[Math.floor(Math.random() * videos.length)];
      embedYouTubeVideo(randomVideo.id, randomVideo.title);
      
      const response = `# ${category.toUpperCase()} Video

## Now Playing
**${randomVideo.title}**

## Video Details
• **Category**: ${category.charAt(0).toUpperCase() + category.slice(1)}
• **Type**: Entertainment Video
• **Quality**: High Definition
• **Duration**: Full Length

## Features
• **Auto-play**: Video starts automatically
• **Full Screen**: Click for full screen mode
• **Controls**: Play, pause, volume controls
• **Quality**: Adjustable video quality

## Enjoy Your Video!
Sit back and enjoy this ${category} video. You can request more videos anytime!`;
      
      addMessage(response, "assistant");
      speak(`Playing ${category} video: ${randomVideo.title}`);
      return;
    }
  }
  
  // If no specific category found, play a general entertainment video
  const generalVideos = videoSearchLibrary["entertainment"];
  const randomVideo = generalVideos[Math.floor(Math.random() * generalVideos.length)];
  embedYouTubeVideo(randomVideo.id, randomVideo.title);
  
  const response = `# Video Search Results

## Now Playing
**${randomVideo.title}**

## Search Query
You searched for: "${cleanQuery || "entertainment"}"

## Video Information
• **Title**: ${randomVideo.title}
• **Category**: Entertainment
• **Status**: Now Playing
• **Quality**: HD

## Available Categories
• **Comedy** - Funny and hilarious videos
• **Music** - Songs and music videos
• **Entertainment** - General entertainment content
• **Sports** - Sports highlights and moments
• **Gaming** - Gaming content and reviews
• **Dance** - Dance performances and tutorials

## Try These Requests
• "comedy video"
• "music video"
• "funny video"
• "sports video"
• "gaming video"`;
  
  addMessage(response, "assistant");
  speak(`Playing video: ${randomVideo.title}`);
}

// === Command Processing ===
async function processTextCommand(command) {
  const cmd = command.toLowerCase().trim();

  if (cmd.includes("pdf") || cmd.includes("syllabus")) {
    if (cmd.includes("cse") || cmd.includes("computer science")) return openPDF("cse");
    if (cmd.includes("ece") || cmd.includes("electronics")) return openPDF("ece");
    if (cmd.includes("mech") || cmd.includes("mechanical")) return openPDF("mech");
    if (cmd.includes("civil")) return openPDF("civil");
    if (cmd.includes("it") || cmd.includes("information technology")) return openPDF("it");
  }

  if (/book|pdf/.test(cmd)) {
    const match = cmd.match(/(?:book|open|read|download)?\s*(?:the)?\s*(.+?)\s*(?:book|pdf)?$/i);
    if (match && match[1]) {
      const bookTitle = match[1].trim();
      const searchQuery = `${bookTitle} :pdf`;
      window.open(`https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`, "_blank");
      speak(`Searching for a free PDF of ${bookTitle}`);
      addMessage(`📚 Searching for free PDF of "${bookTitle}"...`, "assistant");
      return;
    }
  }

  if (cmd.startsWith("open ")) {
    const site = cmd.replace("open ", "").trim();
    const url = site.includes("http") ? site : `https://${site.replace(/ /g, "")}.com`;
    window.open(url, "_blank");
    speak(`Opening ${site}`);
    addMessage(`Opening ${site}...`, "assistant");
    return;
  }

  if (checkAndPlayVideo(cmd)) return;
  
  // Check for video requests
  if (cmd.includes("video") || cmd.includes("watch") || cmd.includes("play")) {
    searchAndPlayVideo(cmd);
    return;
  }

  // Try Wikipedia for ANY question-like input
  if (/^(what|who|where|when|why|how|tell|explain|define|describe)/.test(cmd)) {
    const query = cmd.replace(/^(what is|who is|what are|who are|where is|when is|why is|how is|tell me about|explain|define|describe)\s+/, "").trim();
    if (query) {
      const wikiSuccess = await fetchWikipediaSummary(query);
      if (wikiSuccess) return;
    }
  }

  // Try to generate structured response for any query
  const structuredResponse = generateStructuredResponse(cmd);
  if (structuredResponse) {
    addMessage(structuredResponse, "assistant");
    speak(`Here's information about your query`);
    return;
  }

  // Generate a general structured response for any other input
  const generalResponse = generateGeneralResponse(cmd);
  addMessage(generalResponse, "assistant");
  speak("Here's what I found");
}

// === Structured Response Generator ===
function generateStructuredResponse(query) {
  const responses = {
    "ai": {
      title: "Artificial Intelligence (AI)",
      content: `## What is AI?
Artificial Intelligence (AI) is the simulation of human intelligence in machines. These systems can perform tasks that typically require human intelligence, such as learning, reasoning, and problem-solving.

## Core Components
• **Machine Learning** - Algorithms that improve through experience
• **Natural Language Processing** - Understanding and generating human language
• **Computer Vision** - Interpreting and analyzing visual information
• **Robotics** - Physical interaction with the environment
• **Expert Systems** - Knowledge-based decision making

## Real-World Applications
• **Virtual Assistants** - Siri, Alexa, Google Assistant
• **Autonomous Vehicles** - Self-driving cars and drones
• **Healthcare** - Medical diagnosis and drug discovery
• **Finance** - Fraud detection and algorithmic trading
• **Entertainment** - Content recommendations on Netflix, Spotify

## Types of AI
1. **Narrow AI (ANI)** - Specialized for specific tasks (current technology)
2. **General AI (AGI)** - Human-level intelligence across all domains
3. **Super AI (ASI)** - Intelligence exceeding human capabilities

## Benefits & Challenges
**Benefits:**
• Increased efficiency and productivity
• 24/7 availability
• Reduced human error
• Cost savings

**Challenges:**
• Job displacement concerns
• Privacy and security issues
• Ethical considerations
• Need for regulation`
    },
    "machine learning": {
      title: "Machine Learning (ML)",
      content: `## What is Machine Learning?
Machine Learning is a subset of AI that enables computers to learn and make decisions from data without being explicitly programmed for every scenario.

## How It Works
1. **Data Collection** - Gather relevant information
2. **Data Preparation** - Clean and organize the data
3. **Model Training** - Algorithm learns from the data
4. **Testing** - Evaluate model performance
5. **Deployment** - Use the model for predictions

## Types of Learning
• **Supervised Learning** - Learning with labeled examples (like a teacher)
• **Unsupervised Learning** - Finding hidden patterns in data
• **Reinforcement Learning** - Learning through trial and error with rewards
• **Semi-supervised Learning** - Combination of labeled and unlabeled data

## Popular Algorithms
• **Linear Regression** - Predicting continuous values
• **Decision Trees** - Making decisions through yes/no questions
• **Neural Networks** - Mimicking brain-like processing
• **Random Forest** - Combining multiple decision trees
• **Support Vector Machines** - Finding optimal boundaries

## Practical Applications
• **Image Recognition** - Photo tagging, medical imaging
• **Speech Recognition** - Voice assistants, transcription
• **Recommendation Systems** - Amazon, YouTube suggestions
• **Fraud Detection** - Banking security
• **Predictive Analytics** - Weather forecasting, stock prices`
    },
    "python": {
      title: "Python Programming Language",
      content: `## What is Python?
Python is a high-level, interpreted programming language created by Guido van Rossum in 1991. It's designed to be easy to read and write, making it perfect for beginners and experts alike.

## Why Choose Python?
• **Simple Syntax** - Reads almost like English
• **Versatile** - Works for web, data science, AI, automation
• **Large Community** - Extensive support and resources
• **Rich Libraries** - Pre-built tools for almost everything
• **Cross-Platform** - Runs on Windows, Mac, Linux

## Essential Libraries
• **NumPy** - Mathematical operations and arrays
• **Pandas** - Data manipulation and analysis
• **Matplotlib/Seaborn** - Data visualization
• **Django/Flask** - Web development frameworks
• **TensorFlow/PyTorch** - Machine learning and AI
• **Requests** - HTTP requests and API interactions

## Career Opportunities
• **Data Scientist** - Analyze data to find insights
• **Web Developer** - Build websites and web applications
• **AI/ML Engineer** - Develop intelligent systems
• **DevOps Engineer** - Automate infrastructure
• **Software Developer** - Create desktop applications

## Getting Started
1. Install Python from python.org
2. Learn basic syntax (variables, loops, functions)
3. Practice with small projects
4. Explore libraries relevant to your interests
5. Join Python communities and forums`
    },
    "javascript": {
      title: "JavaScript Programming Language",
      content: `## What is JavaScript?
JavaScript is a dynamic programming language that brings websites to life. Originally created for web browsers, it now powers servers, mobile apps, and desktop applications.

## Key Characteristics
• **Dynamic Typing** - Variables can hold different data types
• **Event-Driven** - Responds to user interactions
• **Interpreted** - No compilation needed
• **Flexible** - Multiple programming paradigms
• **Asynchronous** - Handle multiple tasks simultaneously

## Frontend Frameworks
• **React** - Facebook's library for user interfaces
• **Vue.js** - Progressive framework for building UIs
• **Angular** - Google's full-featured framework
• **Svelte** - Compile-time optimized framework

## Backend Technologies
• **Node.js** - JavaScript runtime for servers
• **Express.js** - Minimal web application framework
• **MongoDB** - NoSQL database (often used with JS)
• **Socket.io** - Real-time communication

## What You Can Build
• **Interactive Websites** - Dynamic user experiences
• **Web Applications** - Gmail, Facebook, Twitter
• **Mobile Apps** - React Native, Ionic
• **Desktop Apps** - Electron (VS Code, Discord)
• **Games** - Browser-based and mobile games

## Learning Path
1. **Basics** - Variables, functions, DOM manipulation
2. **ES6+** - Modern JavaScript features
3. **Async Programming** - Promises, async/await
4. **Framework** - Choose React, Vue, or Angular
5. **Backend** - Learn Node.js for full-stack development`
    }
  };

  const normalizedQuery = query.toLowerCase().trim();
  
  for (const [key, response] of Object.entries(responses)) {
    if (normalizedQuery.includes(key) || key.includes(normalizedQuery)) {
      return `# ${response.title}\n\n${response.content}`;
    }
  }
  
  return null;
}

// === General Response Generator ===
function generateGeneralResponse(query) {
  const topics = {
    // Programming Languages
    "html": { category: "Web Technology", description: "markup language for web pages" },
    "css": { category: "Web Technology", description: "styling language for web design" },
    "react": { category: "Frontend Framework", description: "JavaScript library for user interfaces" },
    "vue": { category: "Frontend Framework", description: "progressive JavaScript framework" },
    "angular": { category: "Frontend Framework", description: "full-featured web framework" },
    "node": { category: "Backend Technology", description: "JavaScript runtime for servers" },
    "express": { category: "Backend Framework", description: "minimal web framework for Node.js" },
    "mongodb": { category: "Database", description: "NoSQL document database" },
    "mysql": { category: "Database", description: "relational database management system" },
    "postgresql": { category: "Database", description: "advanced relational database" },
    "git": { category: "Version Control", description: "distributed version control system" },
    "github": { category: "Platform", description: "code hosting and collaboration platform" },
    "docker": { category: "DevOps Tool", description: "containerization platform" },
    "kubernetes": { category: "DevOps Tool", description: "container orchestration system" },
    "aws": { category: "Cloud Platform", description: "Amazon Web Services cloud computing" },
    "azure": { category: "Cloud Platform", description: "Microsoft cloud computing platform" },
    "blockchain": { category: "Technology", description: "distributed ledger technology" },
    "cryptocurrency": { category: "Digital Currency", description: "digital or virtual currency" },
    "bitcoin": { category: "Cryptocurrency", description: "first and largest cryptocurrency" },
    "ethereum": { category: "Blockchain Platform", description: "decentralized computing platform" },
    "cybersecurity": { category: "Security", description: "protection of digital systems" },
    "data science": { category: "Field", description: "extracting insights from data" },
    "big data": { category: "Technology", description: "large and complex datasets" },
    "cloud computing": { category: "Technology", description: "on-demand computing services" },
    "iot": { category: "Technology", description: "Internet of Things connected devices" },
    "5g": { category: "Network Technology", description: "fifth generation mobile network" },
    "quantum computing": { category: "Computing", description: "quantum mechanical computing" },
    "virtual reality": { category: "Technology", description: "immersive digital environments" },
    "augmented reality": { category: "Technology", description: "enhanced real-world experiences" }
  };

  const normalizedQuery = query.toLowerCase().trim();
  
  // Find matching topic
  for (const [key, info] of Object.entries(topics)) {
    if (normalizedQuery.includes(key) || key.includes(normalizedQuery.replace(/\s+/g, ""))) {
      return generateTopicResponse(key, info.category, info.description);
    }
  }
  
  // Generate response based on query type
  if (normalizedQuery.includes("how to") || normalizedQuery.includes("tutorial")) {
    return generateHowToResponse(normalizedQuery);
  }
  
  if (normalizedQuery.includes("best") || normalizedQuery.includes("top")) {
    return generateBestResponse(normalizedQuery);
  }
  
  if (normalizedQuery.includes("difference") || normalizedQuery.includes("vs")) {
    return generateComparisonResponse(normalizedQuery);
  }
  
  // Default structured response
  return generateDefaultResponse(normalizedQuery);
}

function generateTopicResponse(topic, category, description) {
  const topicTitle = topic.toUpperCase().replace(/([A-Z])/g, ' $1').trim();
  
  return `# ${topicTitle}

## Overview
${topicTitle} is a ${description} in the ${category} domain.

## Key Features
• **Modern Technology** - Uses latest industry standards
• **Scalable** - Grows with your needs
• **Community Support** - Large developer community
• **Documentation** - Comprehensive learning resources
• **Industry Adoption** - Used by major companies

## Common Use Cases
• Web Development Projects
• Enterprise Applications
• Startup Solutions
• Learning and Education
• Professional Development

## Getting Started
1. **Learn the Basics** - Understand core concepts
2. **Practice Projects** - Build small applications
3. **Join Communities** - Connect with other developers
4. **Read Documentation** - Study official guides
5. **Build Portfolio** - Create showcase projects

## Benefits
• Improved productivity
• Better code quality
• Enhanced user experience
• Career opportunities
• Industry relevance`;
}

function generateHowToResponse(query) {
  const topic = query.replace("how to", "").trim();
  
  return `# How To Guide: ${topic.toUpperCase()}

## Step-by-Step Process

## Preparation
• **Research** - Understand the requirements
• **Plan** - Create a clear roadmap
• **Gather Resources** - Collect necessary tools
• **Set Goals** - Define success criteria

## Implementation Steps
1. **Start with Basics** - Learn fundamental concepts
2. **Practice Regularly** - Consistent daily practice
3. **Build Projects** - Apply knowledge practically
4. **Seek Feedback** - Get input from experts
5. **Iterate and Improve** - Refine your approach

## Best Practices
• **Stay Updated** - Follow latest trends
• **Document Progress** - Keep track of learning
• **Join Communities** - Network with peers
• **Be Patient** - Allow time for mastery
• **Stay Consistent** - Regular practice is key

## Common Challenges
• Time management
• Information overload
• Lack of motivation
• Technical difficulties
• Finding quality resources

## Success Tips
• Set realistic goals
• Break down complex tasks
• Celebrate small wins
• Learn from mistakes
• Stay persistent`;
}

function generateBestResponse(query) {
  const topic = query.replace(/best|top/g, "").trim();
  
  return `# Best ${topic.toUpperCase()} Recommendations

## Top Choices

## Popular Options
• **Option 1** - Most widely used and trusted
• **Option 2** - Best for beginners and learning
• **Option 3** - Advanced features and flexibility
• **Option 4** - Cost-effective and reliable
• **Option 5** - Latest technology and innovation

## Selection Criteria
• **Ease of Use** - User-friendly interface
• **Performance** - Speed and efficiency
• **Community** - Active support and resources
• **Documentation** - Clear guides and tutorials
• **Cost** - Value for money

## Comparison Factors
1. **Learning Curve** - How easy to get started
2. **Features** - Available functionality
3. **Scalability** - Growth potential
4. **Support** - Help and maintenance
5. **Integration** - Works with other tools

## Recommendations by Use Case
• **Beginners** - Start with user-friendly options
• **Professionals** - Choose feature-rich solutions
• **Teams** - Focus on collaboration tools
• **Budget-Conscious** - Consider free alternatives
• **Enterprise** - Prioritize scalability and support`;
}

function generateComparisonResponse(query) {
  const items = query.split(/vs|difference|between/).map(item => item.trim()).filter(item => item);
  
  return `# Comparison Guide

## Overview
Comparing different options to help you make an informed decision.

## Key Differences
• **Purpose** - Different intended use cases
• **Features** - Varying functionality and capabilities
• **Performance** - Speed and efficiency differences
• **Learning Curve** - Ease of adoption
• **Community** - Support and resources available

## Comparison Matrix

## Feature Analysis
1. **Functionality** - What each option can do
2. **Performance** - Speed and resource usage
3. **Ease of Use** - User experience quality
4. **Documentation** - Quality of learning materials
5. **Community Support** - Help and resources

## Use Case Scenarios
• **Small Projects** - Lightweight solutions
• **Large Applications** - Robust and scalable options
• **Learning** - Beginner-friendly choices
• **Professional** - Industry-standard tools
• **Experimental** - Cutting-edge technologies

## Decision Factors
• Project requirements
• Team expertise
• Budget constraints
• Timeline considerations
• Long-term maintenance

## Recommendation
Choose based on your specific needs, team skills, and project requirements.`;
}

function generateDefaultResponse(query) {
  return `# Information About: ${query.toUpperCase()}

## Overview
Here's what you should know about ${query}.

## Key Points
• **Important Concept** - Core understanding needed
• **Practical Application** - Real-world usage
• **Benefits** - Advantages and positive aspects
• **Considerations** - Things to keep in mind
• **Learning Path** - How to get started

## Common Questions
1. **What is it?** - Basic definition and purpose
2. **How does it work?** - Underlying mechanisms
3. **Why is it important?** - Relevance and significance
4. **When to use it?** - Appropriate scenarios
5. **How to learn more?** - Resources and next steps

## Getting Started
• Research the basics
• Find reliable resources
• Start with simple examples
• Practice regularly
• Join relevant communities

## Next Steps
• Explore related topics
• Build practical projects
• Connect with experts
• Stay updated with trends
• Share your learning journey`;
}

// === API Lookups ===
async function fetchWikipediaSummary(query) {
  try {
    // Try direct page summary first
    let res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`);
    let data = await res.json();

    // If not found or disambiguation, try Wikipedia search API
    if (!data.extract || data.type === 'disambiguation' || data.type === 'https://mediawiki.org/wiki/HyperSwitch/errors/not_found') {
      const searchRes = await fetch(`https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=1&format=json&origin=*`);
      const searchData = await searchRes.json();
      
      if (searchData[1] && searchData[1][0]) {
        const bestMatch = searchData[1][0];
        res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(bestMatch)}`);
        data = await res.json();
      }
    }

    if (data && data.extract && data.type !== 'https://mediawiki.org/wiki/HyperSwitch/errors/not_found') {
      let response = `# ${data.title}\n\n## Overview\n${data.extract}\n\n## Source\n[Read more on Wikipedia](${data.content_urls.desktop.page})`;
      
      addMessage(response, "assistant");
      
      // Add image if available
      if (data.thumbnail && data.thumbnail.source) {
        setTimeout(() => {
          const messageEl = chatOutput.querySelector('.message.assistant:last-child .message-content');
          if (messageEl) {
            const img = document.createElement("img");
            img.src = data.thumbnail.source;
            img.alt = data.title;
            img.style.cssText = "max-width: 300px; border-radius: 8px; margin: 15px 0; display: block;";
            messageEl.insertBefore(img, messageEl.firstChild);
          }
        }, 100);
      }
      
      speak(data.extract);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Wikipedia API error:', error);
    return false;
  }
}

function saveSessions() {
  localStorage.setItem("chatSessions", JSON.stringify(sessions));
}

// === Run Init ===
document.addEventListener('DOMContentLoaded', init);
