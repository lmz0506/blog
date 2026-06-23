document.addEventListener('DOMContentLoaded', function() {
  var filters = document.querySelectorAll('.github-filter');
  var cards = document.querySelectorAll('.github-wave-card');
  var yearRows = document.querySelectorAll('.github-year-row');
  var activeYear = null;

  function matchesTag(card, tag) {
    if (tag === 'all') return true;
    var tags = (card.dataset.tags || '').split(',').filter(Boolean);
    return tags.indexOf(tag) >= 0;
  }

  function matchesYear(card, year) {
    if (!year) return true;
    return card.dataset.year === year;
  }

  function getActiveTag() {
    var active = document.querySelector('.github-filter.active');
    return active ? active.dataset.tag : 'all';
  }

  function updateYearRows(activeTag) {
    yearRows.forEach(function(row) {
      var year = row.dataset.year;
      var count = 0;
      cards.forEach(function(card) {
        if (matchesYear(card, year) && matchesTag(card, activeTag)) count += 1;
      });
      row.style.display = count > 0 ? '' : 'none';
      var countNode = row.querySelector('.github-year-count');
      if (countNode) countNode.textContent = count;
    });
  }

  function render() {
    var activeTag = getActiveTag();
    cards.forEach(function(card) {
      var visible = matchesTag(card, activeTag) && matchesYear(card, activeYear);
      card.classList.toggle('is-hidden', !visible);
    });
    updateYearRows(activeTag);
    yearRows.forEach(function(row) {
      row.classList.toggle('active', !!activeYear && row.dataset.year === activeYear);
    });
  }

  filters.forEach(function(filter) {
    filter.addEventListener('click', function() {
      filters.forEach(function(item) { item.classList.remove('active'); });
      filter.classList.add('active');
      activeYear = null;
      render();
    });
  });

  yearRows.forEach(function(row) {
    row.addEventListener('click', function() {
      activeYear = activeYear === row.dataset.year ? null : row.dataset.year;
      render();
    });
  });

  render();
});
