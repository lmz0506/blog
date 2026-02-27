// 将 timeline-item 的 data-emoji 属性复制到 timeline-content 上
document.addEventListener('DOMContentLoaded', function() {
  const timelineItems = document.querySelectorAll('.timeline-item[data-emoji]');
  timelineItems.forEach(item => {
    const emoji = item.getAttribute('data-emoji');
    const content = item.querySelector('.timeline-content');
    if (content && emoji) {
      content.setAttribute('data-emoji', emoji);
    }
  });
});
