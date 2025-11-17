// ==================== CHATBOT WITH LIVE DATABASE & ADMIN MONITORING ====================

let currentContext = {
    lastBadgeQueried: null,
    lastStudentData: null,
    conversationHistory: [],
    lastLiveTasksData: null
};

// Random tutorial tips that appear periodically
const randomTutorials = [
    {
        icon: "💡",
        text: "Did you know? You can ask 'Show my tasks today' to see all your completed tasks!",
        action: "Show my tasks today"
    },
    {
        icon: "🎯",
        text: "Pro tip: Type 'tasks yesterday' to review what you accomplished yesterday!",
        action: "My tasks yesterday"
    },
    {
        icon: "📋",
        text: "Quick command: 'Get tasks for badge 9455 today' to check any student's tasks!",
        action: "Get tasks for badge 9455 today"
    },
    {
        icon: "⚡",
        text: "Time saver: Ask 'Who is working now?' to see all active students instantly!",
        action: "Who is working now?"
    },
    {
        icon: "📊",
        text: "Try asking: 'Show productivity report' to see real-time student activity!",
        action: "Show productivity report"
    },
    {
        icon: "📊",
        text: "Need historical data? Type 'tasks for [date]' like 'tasks for 2025-01-15'!",
        action: "Tasks for 2025-01-15"
    },
    {
        icon: "🎨",
        text: "Tip: Use 'my tasks last week' to get a summary of your weekly progress!",
        action: "My tasks last week"
    },
    {
        icon: "💬",
        text: "Chat with me! I can help with registration, schedules, and IT task guides!",
        action: "Help"
    },
    {
        icon: "🏆",
        text: "Fun fact: Type 'self destruct' for a surprise animation! (Don't worry, it's safe!)",
        action: "self destruct"
    },
    {
        icon: "🌟",
        text: "Ask me 'where is Amazon?' to find any production room location!",
        action: "Where is Amazon?"
    }
];

let tutorialInterval = null;
let currentTutorialCloud = null;

// Start showing random tutorials
function startRandomTutorials() {
    // Show first tutorial after 30 seconds
    tutorialInterval = setTimeout(() => {
        showRandomTutorialCloud();
        // Then show every 3 minutes
        tutorialInterval = setInterval(showRandomTutorialCloud, 180000);
    }, 30000);
}

function showRandomTutorialCloud() {
    // Don't show if chat is open
    const chatBox = document.getElementById('chatBox');
    if (chatBox && chatBox.classList.contains('open')) {
        return;
    }

    // Don't show if there's already a cloud visible
    if (currentTutorialCloud) {
        return;
    }

    const randomTip = randomTutorials[Math.floor(Math.random() * randomTutorials.length)];

    // Create tutorial cloud element
    const cloud = document.createElement('div');
    cloud.className = 'tutorial-cloud';
    cloud.innerHTML = `
        <div class="tutorial-cloud-header">
            <span class="tutorial-cloud-icon">${randomTip.icon}</span>
            <span class="tutorial-cloud-title">Quick Tip</span>
        </div>
        <div class="tutorial-cloud-content">${randomTip.text}</div>
        <div class="tutorial-cloud-actions">
            <button class="tutorial-cloud-btn tutorial-cloud-dismiss" onclick="dismissTutorialCloud()">
                Got it
            </button>
            <button class="tutorial-cloud-btn tutorial-cloud-try" onclick="tryTutorialAction('${randomTip.action.replace(/'/g, "\\'")}')">
                Try it! →
            </button>
        </div>
    `;

    // Append to chat widget
    const chatWidget = document.querySelector('.chat-widget');
    chatWidget.appendChild(cloud);

    // Trigger animation
    setTimeout(() => {
        cloud.classList.add('show');
    }, 100);

    currentTutorialCloud = cloud;

    // Auto-dismiss after 15 seconds
    setTimeout(() => {
        dismissTutorialCloud();
    }, 15000);
}

function dismissTutorialCloud() {
    if (!currentTutorialCloud) return;

    currentTutorialCloud.classList.remove('show');

    setTimeout(() => {
        if (currentTutorialCloud && currentTutorialCloud.parentNode) {
            currentTutorialCloud.parentNode.removeChild(currentTutorialCloud);
        }
        currentTutorialCloud = null;
    }, 400);
}

function tryTutorialAction(action) {
    // Dismiss the cloud
    dismissTutorialCloud();

    // Open chat if not open
    const chatBox = document.getElementById('chatBox');
    if (!chatBox.classList.contains('open')) {
        toggleChat();
    }

    // Wait a bit for chat to open, then send the action
    setTimeout(() => {
        document.getElementById('chatInput').value = action;
        sendMessage();
    }, 300);
}

function stopRandomTutorials() {
    if (tutorialInterval) {
        clearTimeout(tutorialInterval);
        clearInterval(tutorialInterval);
        tutorialInterval = null;
    }

    // Also dismiss any visible cloud
    dismissTutorialCloud();
}

const chatKnowledgeBase = {
    // ==================== GREETINGS & IDENTITY ====================
    greetings: {
        keywords: ['hello', 'hi', 'hey', 'hola', 'good morning', 'good afternoon', 'good evening', 'greetings', 'sup', 'yo', 'whats up', "what's up", 'howdy', 'hiya'],
        response: `Hello! 👋 Welcome!\n\nI'm your Intern Assistant, here to help you navigate the attendance system and answer your questions!\n\n💡 Quick commands you can try:\n• "Who is working now?"\n• "Show my tasks today"\n• "Help" - See everything I can do!\n\nWhat would you like to know?`
    },

    identity: {
        keywords: ['who are you', 'what are you', 'tell me about yourself', 'your name', 'introduce yourself', 'about you', 'who created you', 'what is your purpose', 'who made you'],
        response: `🤖 About Me:\n\nI am the Intern Assistant, your friendly AI chatbot!\n\n👨‍💻 Created by: Jayson Levin Tapia\n🎯 Purpose: To help OJT students and admins with the attendance system\n\n📚 My Knowledge:\nI specialize in:\n• System guides and tutorials\n• Real-time student monitoring\n• Task tracking and reports\n• IT procedures and locations\n• Team information\n\n⚠️ Important: My knowledge is limited to this attendance system and Concentrix Tera Tower operations. I cannot answer questions outside of this area.\n\n💬 Ask me anything about the system - I'm here to help!`
    },

    timeDate: {
        keywords: ['what time', 'current time', 'time now', 'what date', 'today date', 'date today', 'what day', 'day today', 'time and date', 'whats the time', "what's the time", 'tell me the time'],
        response: 'TIME_DATE_QUERY',
        isSpecial: true
    },

    goodbye: {
        keywords: ['bye', 'goodbye', 'see you', 'quit', 'exit', 'close', 'later', 'farewell', 'see ya', 'peace out', 'im out', "i'm out", 'gtg', 'gotta go', 'take care'],
        response: 'GHOST_GOODBYE',
        isSpecial: true
    },

    // ==================== SIMPLE QUESTIONS ====================
    thanks: {
        keywords: ['thank you', 'thanks', 'thank', 'thx', 'appreciate', 'appreciate it', 'much appreciated', 'thanks a lot'],
        response: `You're welcome! 😊\n\nI'm glad I could help!\n\nIf you have any more questions, feel free to ask anytime. That's what I'm here for! 💪`
    },

    howAreYou: {
        keywords: ['how are you', 'how r u', 'hows it going', 'whats up', 'how do you do', 'how you doing', 'you ok', 'you good'],
        response: `I'm doing great, thanks for asking! 😄\n\nI'm always ready and excited to help! My circuits are running smoothly, and I'm here to assist you with anything related to the attendance system.\n\nHow can I help you today?`
    },

    yes: {
        keywords: ['yes', 'yeah', 'yep', 'yup', 'sure', 'okay', 'ok', 'alright', 'fine', 'correct', 'right', 'affirmative'],
        response: `Great! 👍\n\nWhat would you like to know or do next?\n\n💡 Try:\n• "Show my tasks today"\n• "Who is working now?"\n• "Help" for all commands`
    },

    no: {
        keywords: ['no', 'nope', 'nah', 'not really', 'negative'],
        response: `No problem! 👌\n\nIs there something else I can help you with?\n\nFeel free to ask me anything about the attendance system!`
    },

    confused: {
        keywords: ['i dont understand', "i don't understand", 'confused', 'what do you mean', 'huh', 'not clear', 'explain', 'can you explain'],
        response: `Let me clarify! 🤔\n\nI can help you with:\n\n📊 LIVE MONITORING:\n• Check who's working now\n• View productivity reports\n• See student tasks in real-time\n\n📋 TASK TRACKING:\n• View your daily tasks\n• Check historical tasks\n• Query any student's tasks\n\n📚 SYSTEM GUIDES:\n• Registration help\n• IT procedures\n• Locations & team info\n\nTry asking: "Help" for the full list!\nOr just tell me what you need help with! 😊`
    },

    capabilities: {
        keywords: ['what can you do', 'your capabilities', 'features', 'what do you know', 'abilities', 'can you help', 'functions'],
        response: `🌟 Here's what I can do:\n\n🔍 REAL-TIME MONITORING:\n✅ Check who's working now\n✅ View productivity reports\n✅ Monitor active/idle students\n✅ Track live tasks\n\n📋 TASK MANAGEMENT:\n✅ Show your daily tasks\n✅ View historical tasks\n✅ Query any student's work\n✅ Generate task reports\n\n👥 STUDENT INFO:\n✅ Look up student details\n✅ Check hours & progress\n✅ View schedules\n✅ Monitor attendance\n\n📚 KNOWLEDGE BASE:\n✅ System tutorials\n✅ IT procedures\n✅ Room locations\n✅ Team information\n\n💬 Try asking me anything! Type "help" for detailed commands!`
    },

    // ==================== SYSTEM BASICS ====================
    registration: {
        keywords: ['register', 'registration', 'sign up', 'new', 'first time', 'create account', 'how to register', 'register myself', 'sign me up', 'enroll', 'join system'],
        response: `To register:\n\n1. Enter your 4-digit ID badge\n2. The system will prompt you to register\n3. Fill in your full name and school\n4. Set up Google Authenticator by scanning the QR code\n5. Enter the 6-digit code to verify\n\nThat's it! You're ready to start tracking your hours.`
    },

    tasks: {
        keywords: ['task', 'log task', 'add task', 'tasks completed', 'daily task', 'how to add', 'logging task', 'record task', 'task management'],
        response: `To add tasks:\n\n1. Make sure you're timed in first\n2. Click the "➕ Add Task" button\n3. Use the "🎯 Quick Select from Presets" for common tasks\n4. Or type manually (Shift+Enter for multiple tasks)\n5. Tasks are auto-saved as you type\n\n⚠️ You MUST log at least one task before timing out!`
    },

    badge: {
        keywords: ['badge', 'id replaced', 'lost badge', 'new badge', 'badge changed', 'replace badge', 'badge issue', 'id problem', 'badge broken'],
        response: `If your badge was replaced:\n\n🔒 Approach your senior immediately to update your Badge ID in the system.\n\nYou cannot time in/out with an old badge number. Only admins can update badge IDs in the system.`
    },

    schedule: {
        keywords: ['schedule', 'change schedule', 'work hours', 'shift', 'time schedule', 'working hours', 'adjust schedule', 'modify schedule'],
        response: `To change your schedule:\n\n⏰ Ask your seniors to adjust your work schedule.\n\nOnly admins can modify schedule settings. They'll update:\n- Your start and end times\n- Grace period\n- Required daily hours`
    },

    early: {
        keywords: ['early', 'arrive early', 'early arrival', 'before schedule', 'came early', 'early time in', 'arrived before'],
        response: `About early arrival:\n\n⚠️ Arriving before your scheduled start time does NOT add extra hours unless approved.\n\nOnly hours within your schedule count. If you arrived 45+ minutes early for a valid reason (emergency, make-up hours), you can request admin approval.`
    },

    authenticator: {
        keywords: ['authenticator', 'google authenticator', 'totp', '6 digit', 'code', 'lost phone', 'authentication', 'verification', 'authenticator app', 'lost access'],
        response: `Google Authenticator issues:\n\n📱 If you lost access to your authenticator:\n1. Contact your senior to reset your TOTP\n2. They'll generate a new QR code\n3. You'll need to set it up again\n\n💡 Tip: Back up your authenticator codes when setting up!`
    },

    timeout: {
        keywords: ['time out', 'timeout', 'forgot to time out', 'auto timeout', 'end shift', 'log out', 'clock out', 'finish work'],
        response: `About time out:\n\n✅ You must log at least one task before timing out\n⏰ System auto times-out at midnight\n🔧 If you forgot to time out, contact your senior to correct your attendance\n\nWhen timing out, review your tasks summary before confirming.`
    },

    reports: {
        keywords: ['report', 'download', 'weekly report', 'pdf', 'csv', 'export', 'attendance report', 'get report', 'how to download'],
        response: `To download reports:\n\n📊 Full Report (CSV):\nDashboard → "📊 Full Report (CSV)"\n\n📄 Weekly Report (PDF):\nDashboard → "📄 Weekly Report" → Select week or date range\n\nReports include all your attendance, hours, and tasks.`
    },

    hours: {
        keywords: ['hours', 'total hours', 'remaining hours', 'progress', 'overtime', 'how many hours', 'work hours', 'accumulated hours', 'hours left'],
        response: `About your hours:\n\n📈 View Dashboard to see:\n- Total accumulated hours\n- Required hours (if set)\n- Progress percentage\n- Estimated days to completion\n\n⏱️ Overtime: Working beyond your scheduled end time is automatically tracked!`
    },

    // ==================== PEOPLE & TEAM ====================
    developer: {
        keywords: ['developer', 'who made', 'who created', 'jayson', 'tapia', 'jayson levin', 'creator', 'made this system', 'programmer', 'coder', 'built this'],
        response: `👨‍💻 System Developer:\n\nJayson Levin Tapia - OJT Student & Lead Developer\n\nHe is an OJT student here at Concentrix Tera Tower who designed and developed this entire attendance management system. This includes the frontend, backend, security implementation, and UI/UX design.\n\n🔧 You can reach him through the footer's social links!`
    },

    betatesters: {
        keywords: ['beta tester', 'qa', 'tester', 'who tested', 'quality assurance', 'testing team', 'testers'],
        response: `🧪 Quality Assurance Team:\n\n• Grace Margaux Vale - QA Lead\n• Justine Baile - Beta Tester\n• Kenneth John Adamos - Beta Tester\n• Sem Carmona - Beta Tester\n\nThey helped test and improve the system before launch!`
    },

    itmanager: {
        keywords: ['it manager', 'manager', 'christopher aquino', 'sir tofi', 'tofi', 'who is the manager', 'who manage', 'it head'],
        response: `👔 IT Manager:\n\nChristopher Aquino (Sir Tofi)\n\nHe is the IT Manager overseeing the IT operations at Concentrix Tera Tower. For major IT concerns or approvals, you can approach Sir Tofi.`
    },

    itsupervisor: {
        keywords: ['it supervisor', 'supervisor', 'mike cercado', 'who is supervisor', 'who supervise'],
        response: `👨‍💼 IT Supervisor:\n\nMike Cercado\n\nHe is the IT Supervisor who manages day-to-day IT operations and assists with technical issues at Concentrix Tera Tower.`
    },

    seniors: {
        keywords: ['senior', 'joshua', 'ramil', 'cordejo', 'pangaral', 'who are the seniors', 'senior staff', 'who to approach'],
        response: `👥 Senior IT Staff:\n\n• Joshua Cordero - Senior\n• Ramil Pangaral - Senior\n\nThey are your go-to seniors for:\n- Badge ID updates\n- Schedule changes\n- Attendance corrections\n- TOTP resets\n- Daily IT guidance`
    },

    // ==================== IT TASK GUIDES ====================
    walltowall: {
        keywords: ['wall to wall', 'walltowall', 'wall-to-wall', 'w2w', 'excel formula', 'vlookup', 'asset verification'],
        response: `🏢 Wall to Wall Task Guide:\n\n📊 EXCEL FORMULA for fast productivity:\n\n=IFNA(VLOOKUP(LEFT(B2,6),Reference!A:B,2,0),\nIFNA(VLOOKUP(LEFT(B2,5),Reference!A:B,2,0),\nIFNA(VLOOKUP(LEFT(B2,4),Reference!A:B,2,0),\nIFNA(VLOOKUP(LEFT(B2,3),Reference!A:B,2,0),\nIFNA(VLOOKUP(LEFT(B2,2),Reference!A:B,2,0),\n"Not Found")))))\n\n🔧 How to implement:\n1. Create a sheet named "Reference" with asset codes\n2. In your main sheet, put serial numbers in column B\n3. Paste this formula in column C (e.g., C2)\n4. Drag the formula down for all rows\n5. Formula will auto-match serial codes to asset info\n\n💡 This speeds up asset verification significantly!`
    },

    compliance: {
        keywords: ['compliance', 'bigfix', 'sir papi', 'papi', 'extracted files', 'compliance check', 'system compliance'],
        response: `✅ Compliance Task Guide:\n\n📋 For Bigfix extracted files:\n\nContact Sir PAPI to get a copy of the Bigfix extracted files for every production floor.\n\nThese files contain:\n• System compliance data\n• Asset verification records\n• Network compliance status\n\nMake sure to organize them by production floor/site!`
    },

    profileremover: {
        keywords: ['profile remover', 'profile remove', 're-profile', 'reprofile', 'delete profile', 'user profile', 'remove profile', 'profile removal'],
        response: `🔧 Profile Remover / Re-profile Guide:\n\n🖥️ AUTOMATED METHOD:\n1. Open Admin account\n2. Press Windows + R\n3. Type: //10.55.194.13\n4. Navigate to Files → Look for "Ramil" folder\n5. Find "Profileremover.bat" file\n6. Copy and paste to "This PC"\n7. Double-click to run\n8. Wait for completion → Restart PC\n\n🛠️ MANUAL METHOD (for selective removal):\n1. Press Windows + R\n2. Type: sysdm.cpl\n3. Go to "Advanced" tab\n4. Click "Settings" under User Profiles\n5. Select specific user account to delete\n6. Click "Delete" → Confirm\n7. Restart if needed\n\n💡 Use manual method when agent requests to keep certain profiles!`
    },

    passwords: {
        keywords: ['password', 'admin password', 'login', 'credentials', 'pass', 'passcode', 'need password'],
        response: `🔐 About Passwords:\n\nI cannot provide any passwords or credentials for security reasons.\n\nFor password-related concerns:\n👉 Contact your seniors who are onsite:\n  • Joshua Cordero\n  • Ramil Pangaral\n\nThey will assist you with:\n- Admin account access\n- System passwords\n- Reset credentials\n\nNever share your personal passwords with anyone!`
    },

    // ==================== LOCATIONS ====================
    locations: {
        keywords: ['amazon', 'floor', 'where is', 'location', '11f', '12f', '14f', '15f', '16f', '17f', '18f', '19f', '20f', '21f', 'what floor', 'room location', 'production room'],
        response: `🏢 Production Room Locations:\n\n11th Floor:\n• Amazon\n• Project Buzz\n\n12th Floor:\n• Bytedance\n• Webjet\n• Healthfirst\n\n14th Floor:\n• Bytedance\n• Healthfirst\n• IBX\n• Amazon EERO\n\n15th Floor:\n• Transurban\n\n16th Floor:\n• Recruitment\n• Admin\n\n17th Floor:\n• Microsoft\n• LinkedIn\n\n18th Floor:\n• Bytedance\n• Aetna\n\n19th Floor:\n• Aetna\n\n20th Floor:\n• Spotify\n• Bytedance\n\n21st Floor:\n• Aetna\n• Real Defense\n• Project Power\n\nNeed specific room? Ask me "Where is [site name]"!`
    },

    // ==================== FUN & EXTRAS ====================
    sleepingquarters: {
        keywords: ['sleeping quarters', 'sq', 'sleep', 'rest area', 'sleeping area', 'nap room', 'sleep room', 'rest room for sleep'],
        response: `😴 Sleeping Quarters (SQ) Information:\n\n⏰ IMPORTANT SCHEDULE:\n\n🚫 CLOSED: 3:00 PM - 4:00 PM daily\n✅ OPEN: All other times\n\n📝 Why closed at 3-4 PM?\nThis is the dedicated cleaning time for the Sleeping Quarters. Please plan your rest breaks accordingly and avoid going there during this hour.\n\n💡 Tip: If you need to rest, plan to go before 3:00 PM or after 4:00 PM!`
    },

    mobilelegends: {
        keywords: ['mobile legends', 'ml', 'play ml', 'gaming', 'best floor for gaming', 'where to play', 'mobile game', 'play games', 'gaming floor', 'best floor ml'],
        response: `🎮 Mobile Legends Gaming Spot:\n\n🏆 BEST FLOOR: 18th Floor\n\nThe 18th floor is known among interns as the best spot for playing Mobile Legends during break time. Good signal, comfortable area, and fellow gamers!\n\n⚠️ Remember:\n• Only play during break times\n• Don't disturb work operations\n• Keep the area clean\n\nEnjoy your games! 🎯`
    },

    buday: {
        keywords: ['buday', 'what is buday', 'meaning of buday', 'buday meaning', 'define buday'],
        response: `🤫 About "Buday"...\n\nAh, you're asking about the mysterious word "BUDAY"! Well, I cannot give you the real definition because Kenneth might find out, and this is a SECRET word that Kenneth will NEVER know! 😏\n\nIt's a highly classified term in the intern vocabulary... 🕵️‍♂️\n\n🤔 Do you REALLY want to know what "buday" means?`,
        requiresConfirmation: true,
        confirmYes: `😂 Hahaha! Nice try!\n\nIf you really want to know the meaning of "buday," you need to:\n\n👉 Ask JUSTINE BAILE directly!\n\nOnly Justine holds the sacred knowledge of this secret word! Good luck getting it out of them! 🤣\n\n(And remember - DON'T tell Kenneth!)`,
        confirmNo: `🤷‍♂️ Sayang! Hahaha!\n\nMaybe next time you'll be brave enough to discover the truth! 😄\n\nThe mystery of "buday" remains... unsolved! 🕵️`
    },

    concentrix: {
        keywords: ['concentrix', 'company', 'about concentrix', 'bridgetowne', 'tera tower', 'exxa tower', 'giga tower', 'where is concentrix', 'concentrix building', 'concentrix location', 'company info', 'where we work'],
        response: `🏢 About Concentrix - Bridgetowne Campus:\n\nConcentrix operates a major campus within the Bridgetowne development in Quezon City, Philippines. This is NOT a single building, but a multi-tower complex!\n\n🗼 CONCENTRIX TOWERS:\n\n1️⃣ TERA TOWER (Where you are now!)\n   • Opened in 2016\n   • Multi-floor operations\n   • Main IT operations hub\n\n2️⃣ EXXA TOWER\n   • Contact center facility\n   • Client-facing operations\n\n3️⃣ GIGA TOWER\n   • Major operations site\n   • Recruitment hub (Ground floor)\n   • Multiple departments\n\n📍 LOCATION:\nBridgetowne Complex, E Rodriguez Jr. Avenue, Quezon City\n\n🏙️ ABOUT BRIDGETOWNE:\nBridgetowne is a master-planned development by Robinsons Land Corporation. It contains multiple office and residential buildings, with Concentrix being one of the major tenants.\n\n💼 Concentrix is a global business services company providing customer experience (CX) solutions and technology to many of the world's best brands!`
    },

    selfdestruct: {
        keywords: ['self destruct', 'selfdestruct', 'self-destruct', 'destroy', 'explode', 'blow up', 'destruct', 'destruction'],
        response: 'SELF_DESTRUCT_SEQUENCE',
        isSpecial: true
    },

    // ==================== ADMIN MONITORING FEATURES ====================
    productivity: {
        keywords: ['productivity', 'who is productive', 'who is working', 'active students', 'idle students', 'task monitor', 'monitor students', 'productivity check', 'who is idle', 'productivity report', 'who working', 'student activity'],
        response: 'DATABASE_QUERY_PRODUCTIVITY',
        isDatabase: true
    },

    liveMonitor: {
        keywords: ['live tasks', 'live monitor', 'real time tasks', 'current tasks', 'who is doing what', 'student activity', 'live activity', 'task activity', 'recent tasks'],
        response: 'DATABASE_QUERY_LIVE_TASKS',
        isDatabase: true
    },

    corrections: {
        keywords: ['corrections', 'pending corrections', 'incomplete records', 'forgot timeout', 'overtime students', 'need correction', 'correction needed', 'pending fixes'],
        response: 'DATABASE_QUERY_CORRECTIONS',
        isDatabase: true
    },

    whoWorking: {
        keywords: ['who is working', 'who working now', 'who timed in', 'who on duty', 'active now', 'currently working', 'who at work'],
        response: 'DATABASE_QUERY_WHO_WORKING',
        isDatabase: true
    },

    // ==================== DATABASE QUERY HANDLERS ====================
    studentInfo: {
        keywords: ['who is badge', 'badge', 'student', 'who is', 'find student'],
        response: 'DATABASE_QUERY_STUDENT',
        isDatabase: true
    },

    hoursRemaining: {
        keywords: ['hours remaining', 'how many hours', 'remaining hours', 'hours left', 'progress'],
        response: 'DATABASE_QUERY_HOURS',
        isDatabase: true
    },

    currentStatus: {
        keywords: ['status', 'currently working', 'timed in', 'on duty', 'at work', 'badge status', 'is badge working', 'check badge'],
        response: 'DATABASE_QUERY_STATUS',
        isDatabase: true
    },

    scheduleQuery: {
        keywords: ['schedule', 'what time', 'shift', 'working hours'],
        response: 'DATABASE_QUERY_SCHEDULE',
        isDatabase: true
    },

    // ==================== TASK QUERY HANDLERS ====================
    myTasksToday: {
        keywords: ['my tasks today', 'show my tasks', 'tasks today', 'what did i do today', 'today tasks', 'my work today'],
        response: 'TASK_QUERY_TODAY',
        isDatabase: true
    },

    myTasksYesterday: {
        keywords: ['my tasks yesterday', 'tasks yesterday', 'what did i do yesterday', 'yesterday tasks', 'my work yesterday'],
        response: 'TASK_QUERY_YESTERDAY',
        isDatabase: true
    },

    tasksForDate: {
        keywords: ['tasks for', 'tasks on', 'get tasks', 'show tasks for date', 'tasks date'],
        response: 'TASK_QUERY_DATE',
        isDatabase: true
    },

    help: {
        keywords: ['help', 'guide', 'how', 'tutorial', 'instructions', 'need help', 'assist me', 'what can you do'],
        response: `Need more help?\n\n📚 Click the help icon (?) in the top-left of the main card for a complete guide\n\n💬 Ask me about:\n\n📊 LIVE DATA QUERIES:\n• "Who is badge [4-digit]?"\n• "How many hours remaining?"\n• "Who is working now?"\n• "Show productivity report"\n• "Who is idle?"\n• "Live tasks monitor"\n• "Corrections needed"\n\n📋 TASK QUERIES:\n• "Show my tasks today"\n• "My tasks yesterday"\n• "Get tasks for badge 9455 today"\n• "Tasks for 2025-01-15"\n• "My tasks last week"\n\n📋 SYSTEM BASICS:\n• Registration & Setup\n• Tasks & Logging\n• Badge Issues\n• Schedule & Hours\n• Reports & Downloads\n\n🔧 IT TASKS:\n• Wall to Wall\n• Compliance\n• Profile Remover\n\n👥 PEOPLE & TEAM\n🏢 ROOM LOCATIONS\n😴 SLEEPING QUARTERS\n🎮 GAMING SPOTS\n\n🎭 Easter Egg: Try "self destruct"!`
    }
};

// ==================== HELPER FUNCTIONS ====================

function extractBadgeNumber(message) {
    const badgeMatch = message.match(/\b\d{4}\b/);
    return badgeMatch ? badgeMatch[0] : null;
}

function extractDate(message) {
    // Match YYYY-MM-DD format
    const isoDateMatch = message.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
    if (isoDateMatch) {
        return isoDateMatch[0];
    }

    // Match relative dates
    if (message.includes('today')) {
        return new Date().toISOString().split('T')[0];
    }
    if (message.includes('yesterday')) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        return yesterday.toISOString().split('T')[0];
    }

    // Match "last week"
    if (message.includes('last week')) {
        const lastWeek = new Date();
        lastWeek.setDate(lastWeek.getDate() - 7);
        return lastWeek.toISOString().split('T')[0];
    }

    return null;
}

function formatHours(hours) {
    if (!hours || hours === 0) return "0h";

    const totalMinutes = Math.round(hours * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;

    if (h === 0) return `${m}m`;
    else if (m === 0) return `${h}h`;
    else return `${h}h ${m}m`;
}

function formatTime(timeString) {
    if (!timeString) return '';
    try {
        return new Date(timeString).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch {
        return 'Invalid time';
    }
}

function formatDate(dateString) {
    if (!dateString) return '';
    try {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    } catch {
        return 'Invalid date';
    }
}

function formatTimeAgo(timeString) {
    if (!timeString) return '';
    try {
        const now = new Date();
        const time = new Date(timeString);
        const diffInSeconds = Math.floor((now - time) / 1000);

        if (diffInSeconds < 60) return 'Just now';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
        return `${Math.floor(diffInSeconds / 86400)}d ago`;
    } catch {
        return '';
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Get current time and date
function getCurrentTimeDate() {
    const now = new Date();

    const options = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    };

    const dateTimeString = now.toLocaleString('en-US', options);

    return `🕐 Current Time & Date:\n\n${dateTimeString}\n\n📍 Location: Concentrix Tera Tower, Bridgetowne\n⏰ Timezone: Philippine Time (PHT / UTC+8)\n\n💡 Tip: Make sure you're tracking your hours accurately!`;
}

// ==================== DATABASE QUERY FUNCTIONS ====================

async function fetchStudentData(idBadge) {
    try {
        const response = await fetch(`${API_BASE_URL}/students/dashboard-with-progress/${idBadge}`);

        if (!response.ok) {
            if (response.status === 404) {
                return { error: 'Student not found with badge: ' + idBadge };
            }
            throw new Error('Failed to fetch student data');
        }

        const data = await response.json();
        currentContext.lastBadgeQueried = idBadge;
        currentContext.lastStudentData = data;

        return data;
    } catch (error) {
        console.error('Error fetching student data:', error);
        return { error: 'Unable to connect to database. Please try again later.' };
    }
}

async function checkStudentStatusChatbot(idBadge) {
    try {
        const response = await fetch(`${API_BASE_URL}/admin/attendance/active-sessions`);

        if (!response.ok) throw new Error('Failed to fetch active sessions');

        const activeSessions = await response.json();
        return activeSessions.find(s => s.idBadge === idBadge) || null;
    } catch (error) {
        console.error('Error checking student status:', error);
        return null;
    }
}

async function fetchProductivityReport() {
    try {
        const response = await fetch(`${API_BASE_URL}/admin/attendance/active-sessions`);
        if (!response.ok) throw new Error('Failed to fetch productivity data');

        const activeSessions = await response.json();

        const productivityData = await Promise.all(
            activeSessions.map(async (session) => {
                try {
                    const taskResponse = await fetch(`${API_BASE_URL}/admin/attendance/${session.id}/tasks`);
                    if (taskResponse.ok) {
                        const taskData = await taskResponse.json();
                        return {
                            ...session,
                            taskCount: taskData.taskCount || 0,
                            tasks: taskData.tasks || []
                        };
                    }
                } catch (error) {
                    console.error(`Failed to fetch tasks for ${session.studentName}`, error);
                }
                return { ...session, taskCount: 0, tasks: [] };
            })
        );

        currentContext.lastLiveTasksData = productivityData;
        return productivityData;
    } catch (error) {
        console.error('Error fetching productivity report:', error);
        return { error: 'Unable to fetch productivity data' };
    }
}

async function fetchCorrectionsNeeded() {
    try {
        const response = await fetch(`${API_BASE_URL}/admin/attendance/incomplete`);
        if (!response.ok) throw new Error('Failed to fetch corrections');

        return await response.json();
    } catch (error) {
        console.error('Error fetching corrections:', error);
        return { error: 'Unable to fetch corrections data' };
    }
}

// ==================== TASK QUERY FUNCTIONS ====================

async function fetchTasksForStudent(idBadge, date) {
    try {
        const response = await fetch(`${API_BASE_URL}/tasks/report/student/${idBadge}?date=${date}`);

        if (!response.ok) {
            throw new Error('Failed to fetch tasks');
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching tasks:', error);
        return { error: 'Unable to fetch tasks. Please try again later.' };
    }
}

async function fetchAllTasksForDate(date) {
    try {
        const response = await fetch(`${API_BASE_URL}/tasks/report/date?date=${date}`);

        if (!response.ok) {
            throw new Error('Failed to fetch tasks for date');
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching tasks for date:', error);
        return { error: 'Unable to fetch tasks. Please try again later.' };
    }
}

// ==================== RESPONSE GENERATOR ====================

async function generateResponse(question) {
    const lowerQuestion = question.toLowerCase();

    // === SPECIAL COMMANDS ===

    // 1. Goodbye/Exit - Ghost Animation
    if (lowerQuestion.includes('bye') ||
        lowerQuestion.includes('goodbye') ||
        lowerQuestion.includes('see you') ||
        lowerQuestion.includes('quit') ||
        lowerQuestion.includes('exit') ||
        lowerQuestion.includes('close') ||
        lowerQuestion.includes('later') ||
        lowerQuestion.includes('farewell') ||
        (lowerQuestion.includes('see') && lowerQuestion.includes('ya')) ||
        lowerQuestion.includes('peace out') ||
        lowerQuestion.includes('gtg') ||
        lowerQuestion.includes('gotta go') ||
        lowerQuestion.includes('take care') ||
        (lowerQuestion.includes('im') && lowerQuestion.includes('out')) ||
        (lowerQuestion.includes("i'm") && lowerQuestion.includes('out'))) {
        setTimeout(() => initiateGhostGoodbye(), 500);
        return '👋 Goodbye! Thanks for chatting!\n\nHave a great day! 🌟\n\nCome back anytime you need help! 😊';
    }

    // 2. Time and Date Query
    if ((lowerQuestion.includes('time') || lowerQuestion.includes('date') || lowerQuestion.includes('day')) &&
        (lowerQuestion.includes('what') || lowerQuestion.includes('current') || lowerQuestion.includes('now') || lowerQuestion.includes('today'))) {
        return getCurrentTimeDate();
    }

    // 3. Self Destruct
    if (lowerQuestion.includes('self destruct') ||
        lowerQuestion.includes('selfdestruct') ||
        lowerQuestion.includes('self-destruct')) {
        setTimeout(() => initiateSelfDestruct(), 500);
        return '🚨 Self-destruct sequence activated!\n\nInitiating countdown...';
    }

    // 4. Buday Easter Egg
    if (lowerQuestion.includes('buday')) {
        return 'SHOW_BUDAY_BUTTONS:' + chatKnowledgeBase.buday.response;
    }

    // === TASK QUERIES ===

    // 1. My tasks today
    if (lowerQuestion.includes('my tasks today') ||
        lowerQuestion.includes('show my tasks') ||
        lowerQuestion.includes('tasks today') ||
        (lowerQuestion.includes('today') && lowerQuestion.includes('task'))) {

        let badge = extractBadgeNumber(lowerQuestion);

        if (!badge && currentContext.lastBadgeQueried) {
            badge = currentContext.lastBadgeQueried;
        }

        if (!badge) {
            return 'Please specify a badge number first.\n\nExample: "Who is badge 9455?" then ask "Show my tasks today"';
        }

        const today = new Date().toISOString().split('T')[0];
        const tasksData = await fetchTasksForStudent(badge, today);

        if (tasksData.error) {
            return `❌ ${tasksData.error}`;
        }

        if (!tasksData.success || !tasksData.report) {
            return `📋 No tasks found for badge ${badge} today (${formatDate(today)}).\n\n💡 Make sure to log your tasks throughout the day!`;
        }

        const report = tasksData.report;

        if (report.tasks.length === 0) {
            return `📋 Tasks for Badge ${badge} - Today:\n\n👤 Student: ${report.studentName}\n📅 Date: ${formatDate(today)}\n\n⚠️ No tasks logged yet today.\n\nRemember to add your tasks as you complete them!`;
        }

        let response = `📋 Tasks for Badge ${badge} - Today:\n\n`;
        response += `👤 Student: ${report.studentName}\n`;
        response += `📅 Date: ${formatDate(today)}\n`;
        response += `⏰ Time In: ${formatTime(report.timeIn)}\n`;
        response += `${report.timeOut ? `🏁 Time Out: ${formatTime(report.timeOut)}\n` : '🟢 Currently Working\n'}`;
        response += `📊 Total Tasks: ${report.tasks.length}\n\n`;
        response += `✅ Completed Tasks:\n`;

        report.tasks.forEach((task, index) => {
            response += `${index + 1}. ${formatTime(task.completedAt)} - ${task.taskDescription}\n`;
        });

        return response;
    }

    // 2. My tasks yesterday
    if (lowerQuestion.includes('yesterday') && lowerQuestion.includes('task')) {

        let badge = extractBadgeNumber(lowerQuestion);

        if (!badge && currentContext.lastBadgeQueried) {
            badge = currentContext.lastBadgeQueried;
        }

        if (!badge) {
            return 'Please specify a badge number first.\n\nExample: "Who is badge 9455?" then ask "My tasks yesterday"';
        }

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayDate = yesterday.toISOString().split('T')[0];

        const tasksData = await fetchTasksForStudent(badge, yesterdayDate);

        if (tasksData.error) {
            return `❌ ${tasksData.error}`;
        }

        if (!tasksData.success || !tasksData.report) {
            return `📋 No tasks found for badge ${badge} yesterday (${formatDate(yesterdayDate)}).\n\n💡 You may not have worked yesterday or tasks weren't logged.`;
        }

        const report = tasksData.report;

        if (report.tasks.length === 0) {
            return `📋 Tasks for Badge ${badge} - Yesterday:\n\n👤 Student: ${report.studentName}\n📅 Date: ${formatDate(yesterdayDate)}\n\n⚠️ No tasks were logged yesterday.`;
        }

        let response = `📋 Tasks for Badge ${badge} - Yesterday:\n\n`;
        response += `👤 Student: ${report.studentName}\n`;
        response += `📅 Date: ${formatDate(yesterdayDate)}\n`;
        response += `⏰ Time In: ${formatTime(report.timeIn)}\n`;
        response += `🏁 Time Out: ${formatTime(report.timeOut)}\n`;
        response += `📊 Total Tasks: ${report.tasks.length}\n\n`;
        response += `✅ Completed Tasks:\n`;

        report.tasks.forEach((task, index) => {
            response += `${index + 1}. ${formatTime(task.completedAt)} - ${task.taskDescription}\n`;
        });

        return response;
    }

    // 3. Tasks for specific date or badge
    if ((lowerQuestion.includes('tasks for') || lowerQuestion.includes('get tasks') || lowerQuestion.includes('show tasks')) &&
        (extractBadgeNumber(lowerQuestion) || extractDate(lowerQuestion))) {

        const badge = extractBadgeNumber(lowerQuestion);
        const date = extractDate(lowerQuestion);

        if (!badge && !date) {
            return 'Please specify either:\n• A badge number: "tasks for badge 9455"\n• A date: "tasks for 2025-01-15"\n• Both: "tasks for badge 9455 on 2025-01-15"';
        }

        // If only date provided, show all students' tasks
        if (!badge && date) {
            const allTasksData = await fetchAllTasksForDate(date);

            if (allTasksData.error) {
                return `❌ ${allTasksData.error}`;
            }

            if (allTasksData.reports.length === 0) {
                return `📋 No tasks found for ${formatDate(date)}.\n\n💡 No students worked or logged tasks on this date.`;
            }

            let response = `📋 All Tasks for ${formatDate(date)}:\n\n`;
            response += `📊 Total Students: ${allTasksData.totalStudents}\n\n`;

            allTasksData.reports.forEach((report, idx) => {
                response += `${idx + 1}. ${report.studentName} (${report.idBadge}):\n`;
                response += `   📋 Tasks: ${report.tasks.length}\n`;
                if (report.tasks.length > 0) {
                    const firstTask = report.tasks[0].taskDescription.substring(0, 40);
                    response += `   📝 First: ${firstTask}${report.tasks[0].taskDescription.length > 40 ? '...' : ''}\n`;
                }
                response += '\n';
            });

            response += `💡 Ask "tasks for badge [4-digit] on ${date}" for specific student details!`;

            return response;
        }

        // If badge provided (with or without date)
        const targetDate = date || new Date().toISOString().split('T')[0];
        const tasksData = await fetchTasksForStudent(badge, targetDate);

        if (tasksData.error) {
            return `❌ ${tasksData.error}`;
        }

        if (!tasksData.success || !tasksData.report) {
            return `📋 No tasks found for badge ${badge} on ${formatDate(targetDate)}.\n\n💡 Student may not have worked on this date.`;
        }

        const report = tasksData.report;

        if (report.tasks.length === 0) {
            return `📋 Tasks for Badge ${badge}:\n\n👤 Student: ${report.studentName}\n📅 Date: ${formatDate(targetDate)}\n\n⚠️ No tasks were logged on this date.`;
        }

        let response = `📋 Tasks for Badge ${badge}:\n\n`;
        response += `👤 Student: ${report.studentName}\n`;
        response += `📅 Date: ${formatDate(targetDate)}\n`;
        response += `⏰ Time In: ${formatTime(report.timeIn)}\n`;
        response += `${report.timeOut ? `🏁 Time Out: ${formatTime(report.timeOut)}\n` : '🟢 Currently Working\n'}`;
        response += `📊 Total Tasks: ${report.tasks.length}\n\n`;
        response += `✅ Completed Tasks:\n`;

        report.tasks.forEach((task, index) => {
            response += `${index + 1}. ${formatTime(task.completedAt)} - ${task.taskDescription}\n`;
        });

        return response;
    }

    // === ADMIN MONITORING QUERIES ===

    // 1. Productivity Report
    if (lowerQuestion.includes('productivity') ||
        lowerQuestion.includes('who is productive') ||
        lowerQuestion.includes('who is idle') ||
        lowerQuestion.includes('active students') ||
        lowerQuestion.includes('monitor students')) {

        const productivityData = await fetchProductivityReport();

        if (productivityData.error) {
            return `❌ ${productivityData.error}`;
        }

        if (productivityData.length === 0) {
            return `📊 Productivity Report:\n\n⚪ No students currently working.\n\nAll students have timed out or haven't started yet.`;
        }

        const veryActive = productivityData.filter(s => s.taskCount >= 5);
        const active = productivityData.filter(s => s.taskCount >= 1 && s.taskCount < 5);
        const idle = productivityData.filter(s => s.taskCount === 0);

        let response = `📊 Live Productivity Report (${productivityData.length} active):\n\n`;

        if (veryActive.length > 0) {
            response += `🟢 VERY ACTIVE (${veryActive.length}):\n`;
            veryActive.forEach(s => {
                response += `  • ${s.studentName} (${s.idBadge}): ${s.taskCount} tasks\n`;
            });
            response += '\n';
        }

        if (active.length > 0) {
            response += `🟡 ACTIVE (${active.length}):\n`;
            active.forEach(s => {
                response += `  • ${s.studentName} (${s.idBadge}): ${s.taskCount} tasks\n`;
            });
            response += '\n';
        }

        if (idle.length > 0) {
            response += `🔴 IDLE (${idle.length}):\n`;
            idle.forEach(s => {
                const timeIn = new Date(s.timeIn);
                const hoursWorked = (new Date() - timeIn) / (1000 * 60 * 60);
                response += `  • ${s.studentName} (${s.idBadge}): No tasks - ${formatHours(hoursWorked)} working\n`;
            });
        }

        response += `\n💡 Tip: Ask "live tasks for badge [4-digit]" for details!`;

        return response;
    }

    // 2. Live Tasks Monitor
    if (lowerQuestion.includes('live tasks') ||
        lowerQuestion.includes('live monitor') ||
        lowerQuestion.includes('current tasks') ||
        lowerQuestion.includes('who is doing what')) {

        const badge = extractBadgeNumber(lowerQuestion);

        if (badge) {
            const productivityData = await fetchProductivityReport();
            const student = productivityData.find(s => s.idBadge === badge);

            if (!student) {
                return `❌ Badge ${badge} is not currently working or not found.\n\nTry: "Is badge ${badge} working now?"`;
            }

            if (student.tasks.length === 0) {
                return `📋 Live Tasks for ${student.studentName}:\n\n🔴 NO TASKS LOGGED YET\n\n⏱️ Working time: ${formatHours((new Date() - new Date(student.timeIn)) / (1000 * 60 * 60))}\n\n⚠️ Student needs to log tasks!`;
            }

            let response = `📋 Live Tasks for ${student.studentName}:\n\n`;
            response += `⏰ Time In: ${formatTime(student.timeIn)}\n`;
            response += `📊 Total Tasks: ${student.taskCount}\n\n`;
            response += `Recent Tasks:\n`;

            student.tasks.slice(-5).reverse().forEach((task, i) => {
                response += `${i + 1}. ${formatTime(task.completedAt)} - ${task.taskDescription}\n`;
            });

            return response;
        } else {
            return `📋 For live task details:\n\n• "live tasks for badge [4-digit]"\n• "productivity report" - See all active students\n• "who is idle?" - Find students without tasks\n\n💡 Example: "live tasks for badge 9455"`;
        }
    }

    // 3. Corrections Needed
    if (lowerQuestion.includes('corrections') ||
        lowerQuestion.includes('incomplete') ||
        lowerQuestion.includes('forgot timeout') ||
        lowerQuestion.includes('overtime') ||
        lowerQuestion.includes('need correction')) {

        const corrections = await fetchCorrectionsNeeded();

        if (corrections.error) {
            return `❌ ${corrections.error}`;
        }

        if (corrections.length === 0) {
            return `✅ No corrections needed!\n\nAll attendance records are complete and accurate.`;
        }

        const critical = corrections.filter(r => {
            const hours = (new Date() - new Date(r.timeIn)) / (1000 * 60 * 60);
            return hours >= 12;
        });

        const autoTimedOut = corrections.filter(r => r.status === 'AUTO_TIMED_OUT');
        const incomplete = corrections.filter(r => r.status === 'INCOMPLETE');

        let response = `⚠️ Corrections Needed (${corrections.length} total):\n\n`;

        if (critical.length > 0) {
            response += `🚨 CRITICAL - 12+ Hours (${critical.length}):\n`;
            critical.forEach(r => {
                const hours = (new Date() - new Date(r.timeIn)) / (1000 * 60 * 60);
                response += `  • ${r.studentName} (${r.idBadge}): ${formatHours(hours)}\n`;
            });
            response += '\n';
        }

        if (autoTimedOut.length > 0) {
            response += `⏰ Auto Timed Out (${autoTimedOut.length}):\n`;
            autoTimedOut.forEach(r => {
                response += `  • ${r.studentName} (${r.idBadge})\n`;
            });
            response += '\n';
        }

        if (incomplete.length > 0) {
            response += `📝 Incomplete Records (${incomplete.length}):\n`;
            incomplete.forEach(r => {
                response += `  • ${r.studentName} (${r.idBadge})\n`;
            });
        }

        response += `\n💡 Admin can fix these in the Corrections tab!`;

        return response;
    }

    // 4. Who is Working Now
    if (lowerQuestion.includes('who is working') ||
        lowerQuestion.includes('who working now') ||
        lowerQuestion.includes('who timed in') ||
        lowerQuestion.includes('active now') ||
        lowerQuestion.includes('who at work')) {

        const productivityData = await fetchProductivityReport();

        if (productivityData.error) {
            return `❌ ${productivityData.error}`;
        }

        if (productivityData.length === 0) {
            return `⚪ No students currently working.\n\nAll students have timed out or haven't started yet.`;
        }

        let response = `🟢 Currently Working (${productivityData.length} students):\n\n`;

        productivityData.forEach(s => {
            const timeIn = new Date(s.timeIn);
            const hoursWorked = (new Date() - timeIn) / (1000 * 60 * 60);
            const taskStatus = s.taskCount >= 5 ? '🟢' : s.taskCount >= 1 ? '🟡' : '🔴';

            response += `${taskStatus} ${s.studentName} (${s.idBadge})\n`;
            response += `   ⏰ Time In: ${formatTime(s.timeIn)}\n`;
            response += `   ⏱️ Working: ${formatHours(hoursWorked)}\n`;
            response += `   📋 Tasks: ${s.taskCount}\n\n`;
        });

        response += `💡 Ask "productivity report" for detailed analysis!`;

        return response;
    }

    // === INDIVIDUAL STUDENT QUERIES ===

    // 1. Student Info Query
    if (lowerQuestion.includes('who is badge') ||
        (lowerQuestion.includes('who is') && extractBadgeNumber(lowerQuestion)) ||
        (lowerQuestion.includes('badge') && lowerQuestion.includes('who'))) {

        const badge = extractBadgeNumber(lowerQuestion);

        if (!badge) {
            return 'Please provide a 4-digit badge number.\n\nExample: "Who is badge 9455?"';
        }

        const studentData = await fetchStudentData(badge);

        if (studentData.error) {
            return `❌ ${studentData.error}\n\nPlease check the badge number and try again.`;
        }

        const activeSession = await checkStudentStatusChatbot(badge);

        return `👤 Student Information:\n\n` +
            `📖 Name: ${studentData.fullName}\n` +
            `🆔 Badge ID: ${studentData.idBadge}\n` +
            `📊 Total Hours: ${formatHours(studentData.totalAccumulatedHours)}\n` +
            `${studentData.requiredHours ? `🎯 Required: ${formatHours(studentData.requiredHours)}\n` : ''}` +
            `${studentData.completionPercentage ? `📈 Progress: ${studentData.completionPercentage.toFixed(1)}%\n` : ''}` +
            `${activeSession ? '🟢 Status: CURRENTLY ON DUTY\n' : '⚪ Status: Not working now\n'}\n` +
            `💡 You can now ask:\n` +
            `• "How many hours remaining?"\n` +
            `• "What's the schedule?"\n` +
            `• "Show my tasks today"\n` +
            `• "Is ${badge} working now?"`;
    }

    // 2. Hours Remaining Query
    if ((lowerQuestion.includes('hours remaining') ||
        lowerQuestion.includes('how many hours') ||
        lowerQuestion.includes('remaining hours') ||
        lowerQuestion.includes('hours left') ||
        lowerQuestion.includes('progress')) && !lowerQuestion.includes('report')) {

        let badge = extractBadgeNumber(lowerQuestion);

        if (!badge && currentContext.lastBadgeQueried) {
            badge = currentContext.lastBadgeQueried;
        }

        if (!badge) {
            return 'Please specify a badge number first.\n\nExample: "Who is badge 9455?" then ask about hours.';
        }

        const studentData = await fetchStudentData(badge);

        if (studentData.error) {
            return `❌ ${studentData.error}`;
        }

        if (!studentData.requiredHours) {
            return `📊 Hours Summary for Badge ${badge}:\n\n` +
                `👤 Student: ${studentData.fullName}\n` +
                `⏱️ Total Accumulated: ${formatHours(studentData.totalAccumulatedHours)}\n\n` +
                `ℹ️ No required hours set for this student yet.`;
        }

        const remaining = studentData.hoursRemaining || 0;
        const estimatedDays = Math.ceil(remaining / 8);

        return `⏱️ Hours Summary for Badge ${badge}:\n\n` +
            `👤 Student: ${studentData.fullName}\n` +
            `📊 Total Accumulated: ${formatHours(studentData.totalAccumulatedHours)}\n` +
            `🎯 Required Hours: ${formatHours(studentData.requiredHours)}\n` +
            `📈 Progress: ${studentData.completionPercentage.toFixed(1)}%\n` +
            `⏳ Remaining: ${formatHours(remaining)}\n` +
            `📅 Estimated Days: ~${estimatedDays} days (8hrs/day)\n\n` +
            `${remaining <= 0 ? '🎉 Completed! Ready for graduation!' : remaining < 40 ? '🔥 Almost there!' : '💪 Keep it up!'}`;
    }

    // 3. Current Status Query
    if ((lowerQuestion.includes('status') ||
        lowerQuestion.includes('working now') ||
        lowerQuestion.includes('on duty') ||
        lowerQuestion.includes('currently working') ||
        lowerQuestion.includes('at work') ||
        lowerQuestion.includes('is badge') ||
        lowerQuestion.includes('badge status')) && !lowerQuestion.includes('who')) {

        let badge = extractBadgeNumber(lowerQuestion);

        if (!badge && currentContext.lastBadgeQueried) {
            badge = currentContext.lastBadgeQueried;
        }

        if (!badge) {
            return 'Please specify a badge number.\n\nExample: "Is badge 9455 working now?" or "Status of badge 9455"';
        }

        const studentData = await fetchStudentData(badge);

        if (studentData.error) {
            return `❌ ${studentData.error}`;
        }

        const activeSession = await checkStudentStatusChatbot(badge);

        if (activeSession) {
            const timeIn = new Date(activeSession.timeIn);
            const now = new Date();
            const hoursWorked = (now - timeIn) / (1000 * 60 * 60);

            return `🟢 ${studentData.fullName} (Badge ${badge}) is CURRENTLY ON DUTY\n\n` +
                `⏰ Time In: ${formatTime(activeSession.timeIn)}\n` +
                `⏱️ Working Time: ${formatHours(hoursWorked)}\n` +
                `📋 Tasks Logged: ${activeSession.taskCount || 0}\n\n` +
                `💡 Real-time status • Just now`;
        } else {
            return `⚪ ${studentData.fullName} (Badge ${badge}) is NOT working right now\n\n` +
                `📊 Total Accumulated Hours: ${formatHours(studentData.totalAccumulatedHours)}\n` +
                `${studentData.requiredHours ? `🎯 Progress: ${studentData.completionPercentage?.toFixed(1)}%\n` : ''}` +
                `🕐 Status: Off duty\n\n` +
                `💡 Try: "Who is working now?" to see all active students`;
        }
    }

    // 4. Schedule Query
    if (lowerQuestion.includes('schedule') || lowerQuestion.includes('shift')) {
        let badge = extractBadgeNumber(lowerQuestion);

        if (!badge && currentContext.lastBadgeQueried) {
            badge = currentContext.lastBadgeQueried;
        }

        if (!badge) {
            return 'Please specify a badge number first.';
        }

        const studentData = await fetchStudentData(badge);

        if (studentData.error) {
            return `❌ ${studentData.error}`;
        }

        if (!studentData.scheduledStartTime || !studentData.scheduleActive) {
            return `📅 Schedule for ${studentData.fullName}:\n\n` +
                `⚠️ No active schedule set yet.\n\n` +
                `Contact admin to set up a work schedule.`;
        }

        return `📅 Schedule for ${studentData.fullName}:\n\n` +
            `⏰ Start Time: ${studentData.scheduledStartTime}\n` +
            `🏁 End Time: ${studentData.scheduledEndTime}\n` +
            `⏱️ Grace Period: ${studentData.gracePeriodMinutes} minutes\n` +
            `📊 Daily Hours: ${studentData.scheduledHoursPerDay?.toFixed(1)} hours\n` +
            `✅ Status: ${studentData.scheduleActive ? 'Active' : 'Inactive'}`;
    }

    // Fall back to keyword matching for non-database queries
    let bestMatch = null;
    let highestScore = 0;

    for (const [category, data] of Object.entries(chatKnowledgeBase)) {
        if (data.isDatabase) continue;

        let score = 0;

        for (const keyword of data.keywords) {
            if (lowerQuestion.includes(keyword)) {
                score += keyword.length;
                const words = lowerQuestion.split(/\s+/);
                if (words.includes(keyword)) {
                    score += 10;
                }
            }
        }

        if (score > highestScore) {
            highestScore = score;
            bestMatch = data.response;
        }
    }

    if (highestScore > 0) {
        return bestMatch;
    }

    // Enhanced default response
    return `I'm not sure about that specific question. Here are topics I can help with:\n\n` +
        `📊 LIVE ADMIN MONITORING:\n` +
        `• "Productivity report" - See who's active/idle\n` +
        `• "Who is working now?" - List all active students\n` +
        `• "Live tasks for badge [4-digit]" - View student tasks\n` +
        `• "Corrections needed" - See pending fixes\n\n` +
        `📋 TASK QUERIES:\n` +
        `• "Show my tasks today" - Your daily tasks\n` +
        `• "My tasks yesterday" - Yesterday's work\n` +
        `• "Tasks for badge 9455 today" - Any student\n` +
        `• "Tasks for 2025-01-15" - Specific date\n\n` +
        `👤 STUDENT QUERIES:\n` +
        `• "Who is badge [4-digit]?" - Get student info\n` +
        `• "How many hours remaining?" - Check progress\n` +
        `• "Is badge [4-digit] working now?" - Status\n\n` +
        `📋 SYSTEM GUIDES:\n` +
        `• Registration, Tasks, Reports\n` +
        `• IT Tasks, Locations, People\n\n` +
        `💡 Try: "show my tasks today" for your daily work!`;
}

// ==================== GHOST GOODBYE ANIMATION ====================

let isGhosting = false;

async function initiateGhostGoodbye() {
    if (isGhosting) return;
    isGhosting = true;

    const chatBox = document.getElementById('chatBox');
    const chatHead = document.querySelector('.chat-head');

    // Add ghost animation class
    chatBox.classList.add('ghost-fade');

    // Wait for animation
    await sleep(2000);

    // Close the chat
    chatBox.classList.remove('open');
    chatBox.classList.remove('ghost-fade');

    // Reset flag
    isGhosting = false;

    // Restart tutorials after closing
    setTimeout(() => {
        startRandomTutorials();
    }, 300000);
}

// ==================== SELF-DESTRUCT ANIMATION ====================

let isDestructing = false;

async function initiateSelfDestruct() {
    if (isDestructing) return;
    isDestructing = true;

    const chatBox = document.getElementById('chatBox');
    const messagesContainer = document.getElementById('chatMessages');

    addChatMessage('⚠️ WARNING: SELF-DESTRUCT SEQUENCE INITIATED!', 'bot');

    await sleep(1000);

    addChatMessage('🚨 THIS ACTION CANNOT BE UNDONE!', 'bot');

    await sleep(1000);

    for (let i = 5; i >= 0; i--) {
        const countdownMsg = document.createElement('div');
        countdownMsg.className = 'chat-message bot-message countdown-message';
        countdownMsg.style.animation = 'shake 0.5s ease-in-out';

        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.textContent = '💣';
        avatar.style.animation = 'pulse 0.5s ease-in-out infinite';

        const content = document.createElement('div');
        content.className = 'message-content';

        const p = document.createElement('p');
        p.style.fontSize = '3rem';
        p.style.fontWeight = 'bold';
        p.style.color = i <= 2 ? '#ef4444' : '#f59e0b';
        p.style.textAlign = 'center';
        p.textContent = i > 0 ? i : 'BOOM!';

        if (i === 0) {
            p.textContent = '💥 BOOM! 💥';
            p.style.animation = 'explode 0.5s ease-out';
        }

        content.appendChild(p);
        countdownMsg.appendChild(avatar);
        countdownMsg.appendChild(content);

        messagesContainer.appendChild(countdownMsg);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        if (i > 0) {
            playBeep();
        }

        await sleep(1000);
    }

    chatBox.style.animation = 'explode 0.5s ease-out';

    await sleep(500);

    chatBox.style.transform = 'scale(0)';
    chatBox.style.opacity = '0';

    await sleep(1000);

    messagesContainer.innerHTML = '';
    chatBox.style.animation = 'fadeIn 1s ease-in';
    chatBox.style.transform = 'scale(1)';
    chatBox.style.opacity = '1';

    await sleep(500);

    addChatMessage('🤖 System Rebooting...', 'bot');

    await sleep(1500);

    addChatMessage('✅ Reboot Complete!\n\nWhew! That was close! 😅\n\nI\'m back online and ready to help!\n\n💡 Pro tip: Maybe don\'t activate the self-destruct next time? 😉', 'bot');

    isDestructing = false;
}

function playBeep() {
    const chatHead = document.querySelector('.chat-head');
    if (chatHead) {
        chatHead.style.transform = 'scale(1.2)';
        setTimeout(() => {
            chatHead.style.transform = 'scale(1)';
        }, 100);
    }
}

// ==================== CHAT UI FUNCTIONS ====================

async function sendMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();

    if (!message) return;

    // Stop tutorials when user is actively chatting
    stopRandomTutorials();

    addChatMessage(message, 'user');
    input.value = '';

    showTypingIndicator();

    try {
        const response = await generateResponse(message);

        hideTypingIndicator();

        if (response.startsWith('SHOW_BUDAY_BUTTONS:')) {
            const actualResponse = response.replace('SHOW_BUDAY_BUTTONS:', '');
            addChatMessage(actualResponse, 'bot', true);
        } else {
            addChatMessage(response, 'bot');
        }

        // Restart tutorials after user stops chatting (5 minutes)
        setTimeout(() => {
            startRandomTutorials();
        }, 300000);

    } catch (error) {
        hideTypingIndicator();
        addChatMessage('❌ Oops! Something went wrong. Please try again.', 'bot');
        console.error('Chat error:', error);
    }
}

// Start tutorials when page loads
document.addEventListener('DOMContentLoaded', function() {
    console.log('Chatbot initialized - starting tutorial clouds');
    startRandomTutorials();
});

function toggleChat() {
    const chatBox = document.getElementById('chatBox');
    const isOpening = !chatBox.classList.contains('open');

    chatBox.classList.toggle('open');

    if (isOpening) {
        const chatInput = document.getElementById('chatInput');
        if (chatInput) {
            chatInput.focus();
        }
        // Stop tutorials when chat is opened
        stopRandomTutorials();
    } else {
        // Restart tutorials when chat is closed (after 5 minutes)
        setTimeout(() => {
            startRandomTutorials();
        }, 300000);
    }
}

function handleChatEnter(event) {
    if (event.key === 'Enter') {
        sendMessage();
    }
}

function askQuestion(question) {
    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
        chatInput.value = question;
        sendMessage();
    }
}

function addChatMessage(text, type, showBudayButtons = false, isTutorial = false) {
    const messagesContainer = document.getElementById('chatMessages');

    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${type}-message`;

    // Add special styling for tutorial messages
    if (isTutorial) {
        messageDiv.classList.add('tutorial-message');
    }

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = type === 'bot' ? '🤖' : '👤';

    const content = document.createElement('div');
    content.className = 'message-content';

    const p = document.createElement('p');
    p.textContent = text;
    p.style.whiteSpace = 'pre-line';

    content.appendChild(p);

    if (showBudayButtons) {
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'buday-buttons';
        buttonContainer.style.cssText = 'display: flex; gap: 0.5rem; margin-top: 0.75rem;';

        const yesBtn = document.createElement('button');
        yesBtn.textContent = '✅ Yes, tell me!';
        yesBtn.className = 'buday-btn buday-yes';
        yesBtn.onclick = () => handleBudayChoice('yes');

        const noBtn = document.createElement('button');
        noBtn.textContent = '❌ No, thanks';
        noBtn.className = 'buday-btn buday-no';
        noBtn.onclick = () => handleBudayChoice('no');

        buttonContainer.appendChild(yesBtn);
        buttonContainer.appendChild(noBtn);
        content.appendChild(buttonContainer);
    }

    messageDiv.appendChild(avatar);
    messageDiv.appendChild(content);

    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // Add entrance animation for tutorial messages
    if (isTutorial) {
        messageDiv.style.animation = 'slideInFromRight 0.5s ease-out';
    }
}

function handleBudayChoice(choice) {
    const allBudayButtons = document.querySelectorAll('.buday-buttons');
    allBudayButtons.forEach(btn => btn.remove());

    if (choice === 'yes') {
        addChatMessage('Yes, tell me!', 'user');

        showTypingIndicator();

        setTimeout(() => {
            hideTypingIndicator();
            addChatMessage(chatKnowledgeBase.buday.confirmYes, 'bot');
        }, 1000);
    } else {
        addChatMessage('No, thanks', 'user');

        showTypingIndicator();

        setTimeout(() => {
            hideTypingIndicator();
            addChatMessage(chatKnowledgeBase.buday.confirmNo, 'bot');
        }, 1000);
    }
}

function showTypingIndicator() {
    const messagesContainer = document.getElementById('chatMessages');

    const typingDiv = document.createElement('div');
    typingDiv.className = 'chat-message bot-message';
    typingDiv.id = 'typingIndicator';

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = '🤖';

    const content = document.createElement('div');
    content.className = 'message-content';

    const indicator = document.createElement('div');
    indicator.className = 'typing-indicator';
    indicator.innerHTML = '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';

    content.appendChild(indicator);
    typingDiv.appendChild(avatar);
    typingDiv.appendChild(content);

    messagesContainer.appendChild(typingDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function hideTypingIndicator() {
    const indicator = document.getElementById('typingIndicator');
    if (indicator) {
        indicator.remove();
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Don't start tutorials immediately - wait for user to open chat
    console.log('Chatbot initialized - tutorials will start when chat is opened');
});