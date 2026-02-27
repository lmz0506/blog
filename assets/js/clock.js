(function() {
    const clock = document.getElementById('homeClock');
    if (!clock) return;

    // 生成刻度
    for (let i = 0; i < 60; i++) {
        const mark = document.createElement('div');
        mark.className = i % 5 === 0 ? 'clock-mark hour-mark' : 'clock-mark';
        mark.style.transform = `rotate(${i * 6}deg) translateX(-50%)`;
        clock.appendChild(mark);
    }

    // 创建指针
    const hourHand = document.createElement('div');
    hourHand.className = 'clock-hand clock-hour-hand';
    hourHand.id = 'clockHour';

    const minuteHand = document.createElement('div');
    minuteHand.className = 'clock-hand clock-minute-hand';
    minuteHand.id = 'clockMinute';

    const secondHand = document.createElement('div');
    secondHand.className = 'clock-hand clock-second-hand';
    secondHand.id = 'clockSecond';

    clock.appendChild(hourHand);
    clock.appendChild(minuteHand);
    clock.appendChild(secondHand);

    // 更新时钟
    function updateHomeClock() {
        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes();
        const seconds = now.getSeconds();

        const secondDeg = seconds * 6;
        const minuteDeg = minutes * 6 + seconds * 0.1;
        const hourDeg = (hours % 12) * 30 + minutes * 0.5;

        document.getElementById('clockSecond').style.transform = `rotate(${secondDeg}deg)`;
        document.getElementById('clockMinute').style.transform = `rotate(${minuteDeg}deg)`;
        document.getElementById('clockHour').style.transform = `rotate(${hourDeg}deg)`;

        const timeString = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        document.getElementById('clockDigital').textContent = timeString;

        const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        const dateString = `${now.getMonth() + 1}月${now.getDate()}日 ${weekdays[now.getDay()]}`;
        document.getElementById('clockDate').textContent = dateString;
    }

    updateHomeClock();
    setInterval(updateHomeClock, 1000);
})();
