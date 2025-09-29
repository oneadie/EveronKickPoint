let interval;
let countdownInterval;
const seen = new Set();
let participants = [];
let settings = { streamer: '', token: '', mode: 'direct', speed: 5, rotation: 0, winner: null, timer: 0 };
let rotation = 0;
let spinning = false;

const canvas = document.getElementById('wheel');
const ctx = canvas.getContext('2d');
const icon = document.getElementById('icon');

function loadStorage() {
    const savedSettings = localStorage.getItem('raffleSettings');
    if (savedSettings) {
        settings = JSON.parse(savedSettings);
        rotation = settings.rotation || 0;
        if (settings.winner) {
            document.getElementById('winner-name').textContent = settings.winner;
            document.getElementById('winner').style.display = 'block';
        }
    }
    const savedParticipants = localStorage.getItem('raffleParticipants');
    if (savedParticipants) participants = JSON.parse(savedParticipants);
    if (settings.streamer && settings.token) {
        document.getElementById('start-raffle').disabled = false;
    }
    if (participants.length > 0) {
        showRaffle();
        updateTable();
        drawWheel();
        if (settings.winner) {
            document.getElementById('spin').disabled = true;
        }
    } else {
        document.getElementById('main').style.display = 'block';
        document.getElementById('raffle').style.display = 'none';
    }
}

loadStorage();

icon.onload = drawWheel;

document.getElementById('settings-btn').addEventListener('click', () => {
    document.getElementById('streamer').value = settings.streamer;
    document.getElementById('token').value = settings.token;
    document.getElementById('timer-minutes').value = settings.timer || '';
    document.getElementById('settings-modal').style.display = 'block';
});

document.getElementById('streamer').addEventListener('input', checkAndFetch);
document.getElementById('token').addEventListener('input', checkAndFetch);

function checkAndFetch() {
    const streamer = document.getElementById('streamer').value.trim();
    const token = document.getElementById('token').value.trim();
    if (streamer && token) {
        fetchRedemptions(streamer, token);
    }
}

document.getElementById('close-settings').addEventListener('click', () => {
    document.getElementById('settings-modal').style.display = 'none';
});

document.getElementById('save-settings').addEventListener('click', () => {
    settings.streamer = document.getElementById('streamer').value.trim();
    settings.token = document.getElementById('token').value.trim();
    settings.timer = parseInt(document.getElementById('timer-minutes').value) || 0;
    localStorage.setItem('raffleSettings', JSON.stringify(settings));
    document.getElementById('settings-modal').style.display = 'none';
    if (settings.streamer && settings.token) {
        document.getElementById('start-raffle').disabled = false;
    }
});

document.getElementById('start-raffle').addEventListener('click', () => {
    showRaffle();
    if (interval) clearInterval(interval);
    if (countdownInterval) clearInterval(countdownInterval);
    seen.clear();
    fetchRedemptions(settings.streamer, settings.token);
    interval = setInterval(() => fetchRedemptions(settings.streamer, settings.token), 10000);

    if (settings.timer > 0) {
        let remainingTime = settings.timer * 60;
        updateTimerDisplay(remainingTime);
        document.getElementById('timer-display').style.display = 'block';
        countdownInterval = setInterval(() => {
            remainingTime--;
            updateTimerDisplay(remainingTime);
            if (remainingTime <= 0) {
                clearInterval(countdownInterval);
                clearInterval(interval);
                document.getElementById('timer-time').textContent = '00:00';
            }
        }, 1000);
    } else {
        document.getElementById('timer-display').style.display = 'none';
    }
});

function updateTimerDisplay(time) {
    const min = Math.floor(time / 60);
    const sec = time % 60;
    document.getElementById('timer-time').textContent = `${min}:${sec.toString().padStart(2, '0')}`;
}

function showRaffle() {
    document.getElementById('main').style.display = 'none';
    document.getElementById('raffle').style.display = 'block';
    document.getElementById('mode').value = settings.mode;
    document.getElementById('speed').value = settings.speed;
    document.getElementById('speed-value').textContent = settings.speed;
    document.getElementById('spin').disabled = false;
}

document.getElementById('reset').addEventListener('click', () => {
    if (confirm('Сбросить участников и вернуться на главную?')) {
        participants = [];
        settings.winner = null;
        saveSettings();
        saveParticipants();
        updateTable();
        drawWheel();
        document.getElementById('winner').style.display = 'none';
        document.getElementById('eliminated').style.display = 'none';
        document.getElementById('main').style.display = 'block';
        document.getElementById('raffle').style.display = 'none';
        if (interval) clearInterval(interval);
        if (countdownInterval) clearInterval(countdownInterval);
        document.getElementById('timer-display').style.display = 'none';
        seen.clear();
    }
});

function saveSettings() {
    settings.rotation = rotation;
    localStorage.setItem('raffleSettings', JSON.stringify(settings));
}

function saveParticipants() {
    localStorage.setItem('raffleParticipants', JSON.stringify(participants));
}

document.getElementById('wheel-settings').addEventListener('click', () => {
    document.getElementById('mode').value = settings.mode;
    document.getElementById('speed').value = settings.speed;
    document.getElementById('speed-value').textContent = settings.speed;
    document.getElementById('wheel-modal').style.display = 'block';
});

document.getElementById('close-wheel').addEventListener('click', () => {
    document.getElementById('wheel-modal').style.display = 'none';
});

document.getElementById('save-wheel').addEventListener('click', () => {
    settings.mode = document.getElementById('mode').value;
    const speedInput = parseFloat(document.getElementById('speed').value);
    settings.speed = Math.max(0.1, Math.min(10, speedInput)); // Ensure speed is between 0.1 and 10
    settings.winner = null; // Reset winner
    document.getElementById('winner').style.display = 'none'; // Hide winner display
    document.getElementById('spin').disabled = false; // Enable spin button
    saveSettings();
    document.getElementById('wheel-modal').style.display = 'none';
    drawWheel();
});

const speedInput = document.getElementById('speed');
const speedValue = document.getElementById('speed-value');
speedInput.addEventListener('input', () => {
    speedValue.textContent = speedInput.value;
});

function fetchRedemptions(streamer, token) {
    const targetUrl = `https://kick.com/api/v2/channels/${streamer}/redemptions`;
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
    fetch(proxyUrl, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
        }
    })
    .then(res => {
        if (!res.ok) throw new Error(res.status);
        return res.json();
    })
    .then(data => {
        let redemptions = data.data?.redemptions || [];
        redemptions.forEach(item => {
            if (seen.has(item.id)) return;
            seen.add(item.id);
            let user = participants.find(p => p.name === item.username);
            if (!user) {
                user = { name: item.username, message: item.user_input || 'Нет ввода', count: 0 };
                participants.push(user);
            }
            user.count++;
            saveParticipants();
        });
        updateTable();
        drawWheel();
    })
    .catch(err => {
        console.error('Ошибка:', err);
    });
}

function updateTable() {
    const tbody = document.querySelector('#table tbody');
    tbody.innerHTML = '';
    participants.forEach((p, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${p.name}</td>
            <td contenteditable="true" onblur="editMessage(${index}, this.textContent)">${p.message}</td>
            <td>${p.count}</td>
            <td><button onclick="deleteParticipant(${index})">✖</button></td>
        `;
        tbody.appendChild(row);
    });
    const totalParticipants = participants.length;
    const totalEntries = participants.reduce((sum, p) => sum + p.count, 0);
    document.getElementById('participant-count').textContent = `Участников: ${totalParticipants}`;
}

function editMessage(index, text) {
    participants[index].message = text.trim();
    saveParticipants();
    updateTable();
}

function deleteParticipant(index) {
    if (confirm('Удалить игрока?')) {
        participants.splice(index, 1);
        saveParticipants();
        updateTable();
        drawWheel();
    }
}

function drawWheel() {
    const total = participants.reduce((sum, p) => sum + getWeight(p), 0);
    if (total === 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let startAngle = rotation;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = centerX - 10;
    participants.forEach((p, i) => {
        const weight = getWeight(p) / total;
        const angle = weight * 2 * Math.PI;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, startAngle, startAngle + angle);
        ctx.lineTo(centerX, centerY);
        ctx.fillStyle = getColor(i);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
        const textAngle = startAngle + angle / 2;
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(textAngle);
        ctx.textAlign = 'right';
        ctx.fillStyle = 'white';
        ctx.font = 'bold 16px Arial';
        ctx.fillText(p.name, radius - 20, 5);
        ctx.restore();
        startAngle += angle;
    });
    const iconRadius = 40;
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, iconRadius, 0, 2 * Math.PI);
    ctx.clip();
    ctx.drawImage(icon, centerX - iconRadius, centerY - iconRadius, iconRadius * 2, iconRadius * 2);
    ctx.restore();
    ctx.beginPath();
    ctx.moveTo(centerX + radius + 20, centerY - 20);
    ctx.lineTo(centerX + radius + 20, centerY + 20);
    ctx.lineTo(centerX + radius - 20, centerY);
    ctx.closePath();
    ctx.beginPath();
    ctx.moveTo(centerX - 20, centerY - radius - 20);
    ctx.lineTo(centerX + 20, centerY - radius - 20);
    ctx.lineTo(centerX, centerY - radius + 20);
    ctx.closePath();
    ctx.fillStyle = 'red';
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.stroke();
}

function getWeight(p) {
    return settings.mode === 'direct' ? p.count : (1 / (p.count || 1));
}

function getColor(i) {
    const colors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#E57373', '#64B5F6', '#FFF176', '#81C784'];
    return colors[i % colors.length];
}

function selectWinnerIndex() {
    const total = participants.reduce((sum, p) => sum + getWeight(p), 0);
    let random = Math.random() * total;
    for (let i = 0; i < participants.length; i++) {
        random -= getWeight(participants[i]);
        if (random <= 0) return i;
    }
    return participants.length - 1;
}

document.getElementById('spin').addEventListener('click', () => {
    if (spinning || participants.length === 0) return;
    spinning = true;
    if (interval) clearInterval(interval);
    if (countdownInterval) clearInterval(countdownInterval); // Stop the timer
    document.getElementById('timer-display').style.display = 'none'; // Hide timer display
    document.getElementById('eliminated').style.display = 'none';
    document.getElementById('winner').style.display = 'none';

    const winnerIndex = selectWinnerIndex();
    const total = participants.reduce((sum, p) => sum + getWeight(p), 0);
    let startAngle = 0;
    for (let i = 0; i < winnerIndex; i++) {
        startAngle += (getWeight(participants[i]) / total) * 2 * Math.PI;
    }
    const sectorAngle = (getWeight(participants[winnerIndex]) / total) * 2 * Math.PI;
    const targetAngle = (startAngle + sectorAngle / 2) % (2 * Math.PI);
    const adjustedTargetAngle = (3 * Math.PI / 2 - targetAngle) % (2 * Math.PI);
    const currentAngle = rotation % (2 * Math.PI);
    let delta = adjustedTargetAngle - currentAngle;
    if (delta < 0) delta += 2 * Math.PI;
    if (delta > Math.PI) delta -= 2 * Math.PI;
    const baseSpinTime = 5000 + Math.random() * 3000;
    const spinTime = baseSpinTime * settings.speed;
    const fullRotations = Math.floor(Math.random() * 3 + 3);
    const totalRotation = delta + fullRotations * 2 * Math.PI;
    let currentTime = 0;

    const anim = () => {
        const t = currentTime / spinTime;
        const easeOut = 1 - Math.pow(1 - t, 3);
        rotation = (currentAngle + totalRotation * easeOut) % (2 * Math.PI);
        drawWheel();
        currentTime += 16;
        if (currentTime < spinTime) {
            requestAnimationFrame(anim);
        } else {
            rotation = adjustedTargetAngle;
            drawWheel();
            spinning = false;
            const selectedPlayer = participants[winnerIndex];
            if (settings.mode === 'direct') {
                settings.winner = selectedPlayer.name;
                document.getElementById('winner-name').textContent = selectedPlayer.name;
                document.getElementById('winner').style.display = 'block';
                document.getElementById('spin').disabled = true;
                saveSettings();
            } else {
                document.getElementById('eliminated-name').textContent = selectedPlayer.name;
                document.getElementById('eliminated').style.display = 'block';
                const index = participants.findIndex(p => p.name === selectedPlayer.name);
                if (index !== -1) {
                    participants.splice(index, 1);
                    saveParticipants();
                    updateTable();
                    drawWheel();
                }
                if (participants.length === 1) {
                    settings.winner = participants[0].name;
                    document.getElementById('winner-name').textContent = participants[0].name;
                    document.getElementById('winner').style.display = 'block';
                    document.getElementById('eliminated').style.display = 'none';
                    document.getElementById('spin').disabled = true;
                    saveSettings();
                }
            }
        }
    };
    anim();
});

