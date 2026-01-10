// saved-tests.js — UI for browsing and loading saved tests
// Depends on TestStorage (storage.js) and Bootstrap's modal markup

(function () {
  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    Object.keys(attrs).forEach(k => {
      if (k === 'text') node.textContent = attrs[k];
      else if (k === 'html') node.innerHTML = attrs[k];
      else node.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(c => node.appendChild(c));
    return node;
  }

  async function renderSavedTestsList(container) {
    container.innerHTML = '';
    // Defensive: ensure TestStorage available
    if (!window.TestStorage || typeof TestStorage.getAllTests !== 'function') {
      container.appendChild(el('div', { class: 'text-muted', text: 'Saved tests unavailable.' }));
      return;
    }

    const tests = await TestStorage.getAllTests();
    if (!tests || tests.length === 0) {
      container.appendChild(el('div', { class: 'text-muted', text: 'No saved tests yet.' }));
      return;
    }

    const list = el('div', { class: 'list-group' });

    for (const t of tests) {
      const item = el('div', { class: 'list-group-item d-flex justify-content-between align-items-start gap-2' });
      const left = el('div', { class: 'me-auto' });
      left.appendChild(el('div', { class: 'fw-bold', text: t.title || t.id }));
      left.appendChild(el('div', { class: 'small text-muted', text: 'Created: ' + new Date(t.createdAt).toLocaleString() + ' • Q: ' + ((t.meta && t.meta.totalQuestions) || (t.questions || []).length) }));

      // last attempt info
      const la = await TestStorage.getLastAttempt(t.id);
      if (la) left.appendChild(el('div', { class: 'small text-muted mt-1', text: `Last: ${new Date(la.timestamp).toLocaleString()} — ${la.score}/${la.total} (${la.percentage}%) — ${la.pass ? 'Passed' : 'Failed'}` }));
      else left.appendChild(el('div', { class: 'small text-muted mt-1', text: 'No attempts yet' }));

      const actions = el('div', {});
      const loadBtn = el('button', { class: 'btn btn-sm btn-primary me-2', type: 'button', text: 'Load' });
      loadBtn.addEventListener('click', async () => {
        try {
          const res = await TestStorage.loadTestById(t.id, { resetProgress: true });
          if (res) {
            // Close modal
            const modalEl = document.getElementById('savedTestsModal');
            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();
            // Notify user
            alert('Loaded test: ' + (t.title || t.id));
          }
        } catch (err) {
          console.error('Failed to load test', err);
          alert('Unable to load saved test. See console for details.');
        }
      });

      const viewBtn = el('button', { class: 'btn btn-sm btn-outline-secondary', type: 'button', text: 'Details' });
      viewBtn.addEventListener('click', () => {
        // Toggle a quick details section for attempts
        let details = item.querySelector('.saved-test-details');
        if (details) {
          details.remove();
          return;
        }
        details = el('div', { class: 'saved-test-details mt-2 small text-muted' });
        details.textContent = 'Attempts:';
        const attemptsDiv = el('div', { class: 'mt-1' });
        if (TestStorage.getAttemptsForTest && typeof TestStorage.getAttemptsForTest === 'function') {
          TestStorage.getAttemptsForTest(t.id).then(arr => {
            if (!arr || arr.length === 0) return attemptsDiv.appendChild(el('div', { class: 'text-muted', text: 'No attempts' }));
            arr.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
            arr.forEach(a => {
              attemptsDiv.appendChild(el('div', { class: 'mb-1', text: `${new Date(a.timestamp).toLocaleString()} — ${a.score}/${a.total} (${a.percentage}%) — ${a.pass ? 'Passed' : 'Failed'}` }));
            });
          }).catch(err => {
            console.error('fetch attempts failed', err);
            attemptsDiv.appendChild(el('div', { class: 'text-muted', text: 'Unable to fetch attempts' }));
          });
        } else {
          attemptsDiv.appendChild(el('div', { class: 'text-muted', text: 'Attempts API unavailable' }));
        }
        details.appendChild(attemptsDiv);
        item.appendChild(details);
      });

      actions.appendChild(loadBtn);
      actions.appendChild(viewBtn);

      item.appendChild(left);
      item.appendChild(actions);
      list.appendChild(item);
    }

    container.appendChild(list);
  }

  // Init: bind event when modal shown
  document.addEventListener('DOMContentLoaded', () => {
    const modalEl = document.getElementById('savedTestsModal');
    if (!modalEl) return;
    modalEl.addEventListener('show.bs.modal', () => {
      const container = document.getElementById('saved-tests-list');
      if (container) renderSavedTestsList(container);
    });
  });
})();