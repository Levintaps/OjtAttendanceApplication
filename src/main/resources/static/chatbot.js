// ==================== CHATBOT WITH LIVE DATABASE & ADMIN MONITORING ====================

let currentContext = {
    lastBadgeQueried: null,
    lastStudentData: null,
    conversationHistory: [],
    lastLiveTasksData: null
};

const chatKnowledgeBase = {
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
        response: `👨‍💻 System Developer:\n\nJayson Levin Tapia - OJT Student & Lead Developer\n\nHe is an OJT student here at Concentrix Tera Tower who designed and developed this entire attendance management system. This includes the frontend, backend, security implementation, and UI/UX design.\n\n📧 You can reach him through the footer's social links!`
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
        response: `👥 Senior IT Staff:\n\n• Joshua Cordejo - Senior\n• Ramil Pangaral - Senior\n\nThey are your go-to seniors for:\n- Badge ID updates\n- Schedule changes\n- Attendance corrections\n- TOTP resets\n- Daily IT guidance`
    },

    // ==================== IT TASK GUIDES ====================
    walltowall: {
        keywords: ['wall to wall', 'walltowall', 'wall-to-wall', 'w2w', 'excel formula', 'vlookup', 'asset verification'],
        response: `🏢 Wall to Wall Task Guide:\n\n📊 EXCEL FORMULA for fast productivity:\n\n=IFNA(VLOOKUP(LEFT(B2,6),Reference!A:B,2,0),\nIFNA(VLOOKUP(LEFT(B2,5),Reference!A:B,2,0),\nIFNA(VLOOKUP(LEFT(B2,4),Reference!A:B,2,0),\nIFNA(VLOOKUP(LEFT(B2,3),Reference!A:B,2,0),\nIFNA(VLOOKUP(LEFT(B2,2),Reference!A:B,2,0),\n"Not Found")))))\n\n📝 How to implement:\n1. Create a sheet named "Reference" with asset codes\n2. In your main sheet, put serial numbers in column B\n3. Paste this formula in column C (e.g., C2)\n4. Drag the formula down for all rows\n5. Formula will auto-match serial codes to asset info\n\n💡 This speeds up asset verification significantly!`
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
        response: `🔐 About Passwords:\n\nI cannot provide any passwords or credentials for security reasons.\n\nFor password-related concerns:\n👉 Contact your seniors who are onsite:\n  • Joshua Cordejo\n  • Ramil Pangaral\n\nThey will assist you with:\n- Admin account access\n- System passwords\n- Reset credentials\n\nNever share your personal passwords with anyone!`
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
        confirmNo: `🤷‍♂️ Sayang! Hahaha!\n\nMaybe next time you'll be brave enough to discover the truth! 😄\n\nThe mystery of "buday" remains... unsolved! 🔍`
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

    help: {
        keywords: ['help', 'guide', 'how', 'tutorial', 'instructions', 'need help', 'assist me', 'what can you do'],
        response: `Need more help?\n\n📚 Click the help icon (?) in the top-left of the main card for a complete guide\n\n💬 Ask me about:\n\n📊 LIVE DATA QUERIES:\n• "Who is badge [4-digit]?"\n• "How many hours remaining?"\n• "Who is working now?"\n• "Show productivity report"\n• "Who is idle?"\n• "Live tasks monitor"\n• "Corrections needed"\n\n📋 SYSTEM BASICS:\n• Registration & Setup\n• Tasks & Logging\n• Badge Issues\n• Schedule & Hours\n• Reports & Downloads\n\n🔧 IT TASKS:\n• Wall to Wall\n• Compliance\n• Profile Remover\n\n👥 PEOPLE & TEAM\n🏢 ROOM LOCATIONS\n😴 SLEEPING QUARTERS\n🎮 GAMING SPOTS\n\n🎭 Easter Egg: Try "self destruct"!`
    }
};

// ==================== HELPER FUNCTIONS ====================

function extractBadgeNumber(message) {
    const badgeMatch = message.match(/\b\d{4}\b/);
    return badgeMatch ? badgeMatch[0] : null;
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

        // Fetch task data for each active student
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

// ==================== RESPONSE GENERATOR ====================

async function generateResponse(question) {
    const lowerQuestion = question.toLowerCase();

    // === SPECIAL COMMANDS ===
    if (lowerQuestion.includes('self destruct') ||
        lowerQuestion.includes('selfdestruct') ||
        lowerQuestion.includes('self-destruct')) {
        setTimeout(() => initiateSelfDestruct(), 500);
        return '🚨 Self-destruct sequence activated!\n\nInitiating countdown...';
    }

    if (lowerQuestion.includes('buday')) {
        return 'SHOW_BUDAY_BUTTONS:' + chatKnowledgeBase.buday.response;
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

        // Categorize students
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
            // Show tasks for specific student
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
            // Show all live tasks
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
               `📛 Name: ${studentData.fullName}\n` +
               `🆔 Badge ID: ${studentData.idBadge}\n` +
               `📊 Total Hours: ${formatHours(studentData.totalAccumulatedHours)}\n` +
               `${studentData.requiredHours ? `🎯 Required: ${formatHours(studentData.requiredHours)}\n` : ''}` +
               `${studentData.completionPercentage ? `📈 Progress: ${studentData.completionPercentage.toFixed(1)}%\n` : ''}` +
               `${activeSession ? '🟢 Status: CURRENTLY ON DUTY\n' : '⚪ Status: Not working now\n'}\n` +
               `💡 You can now ask:\n` +
               `• "How many hours remaining?"\n` +
               `• "What's the schedule?"\n` +
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

        // Fetch student data first to get name
        const studentData = await fetchStudentData(badge);

        if (studentData.error) {
            return `❌ ${studentData.error}`;
        }

        // Then check if they're currently working
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
           `• "Corrections needed" - See pending fixes\n` +
           `• "Who is idle?" - Find inactive students\n\n` +
           `👤 STUDENT QUERIES:\n` +
           `• "Who is badge [4-digit]?" - Get student info\n` +
           `• "How many hours remaining?" - Check progress\n` +
           `• "Is badge [4-digit] working now?" - Status\n` +
           `• "What's the schedule?" - View work hours\n\n` +
           `📋 SYSTEM GUIDES:\n` +
           `• Registration, Tasks, Reports\n` +
           `• IT Tasks (Wall to Wall, Profile Remover)\n` +
           `• Locations, People, Help\n\n` +
           `💡 Try: "productivity report" for live monitoring!`;
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
    } catch (error) {
        hideTypingIndicator();
        addChatMessage('❌ Oops! Something went wrong. Please try again.', 'bot');
        console.error('Chat error:', error);
    }
}

function toggleChat() {
    const chatBox = document.getElementById('chatBox');
    chatBox.classList.toggle('open');

    if (chatBox.classList.contains('open')) {
        document.getElementById('chatInput').focus();
    }
}

function handleChatEnter(event) {
    if (event.key === 'Enter') {
        sendMessage();
    }
}

function askQuestion(question) {
    document.getElementById('chatInput').value = question;
    sendMessage();
}

function addChatMessage(text, type, showBudayButtons = false) {
    const messagesContainer = document.getElementById('chatMessages');

    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${type}-message`;

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
