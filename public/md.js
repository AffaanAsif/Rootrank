/* tiny, safe markdown: everything is HTML-escaped first, then a few patterns are turned into tags */
window.renderMD = function (src) {
  var esc = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  var inline = function (s) {
    s = esc(s);
    var codes = [];
    s = s.replace(/`([^`]+)`/g, function (m, c) { codes.push(c); return '\u0001' + (codes.length - 1) + '\u0002'; });
    s = s.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
    s = s.replace(/(^|[^*\w])\*([^*\n]+)\*(?![*\w])/g, '$1<i>$2</i>');
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    return s.replace(/\u0001(\d+)\u0002/g, function (m, n) { return '<code>' + codes[+n] + '</code>'; });
  };
  var codeLine = function (l) {
    if (/^\$ /.test(l)) return '<span class="cm" data-c="' + esc(l.slice(2)) + '" title="Click to send to the terminal"><i>$</i> ' + esc(l.slice(2)) + '</span>';
    return '<span class="po">' + esc(l) + '</span>';
  };
  var cells = function (l) { return l.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map(function (x) { return x.trim(); }); };
  var lines = String(src || '').split('\n'), out = [], i = 0;
  while (i < lines.length) {
    var l = lines[i];
    if (/^```/.test(l)) {
      var code = []; i++;
      while (i < lines.length && !/^```/.test(lines[i])) { code.push(lines[i]); i++; }
      i++; out.push('<pre><code>' + code.map(codeLine).join('\n') + '</code></pre>'); continue;
    }
    if (/^\s*\|/.test(l)) {
      var rows = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) { rows.push(lines[i]); i++; }
      var head = cells(rows[0]), body = rows.slice(1).filter(function (r) { return !/^\s*\|[\s:|-]+\|?\s*$/.test(r); });
      out.push('<div class="tw"><table><thead><tr>' + head.map(function (c) { return '<th>' + inline(c) + '</th>'; }).join('') + '</tr></thead><tbody>' +
        body.map(function (r) { return '<tr>' + cells(r).map(function (c) { return '<td>' + inline(c) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>');
      continue;
    }
    var h = /^(#{2,3})\s+(.*)$/.exec(l);
    if (h) { out.push('<h' + h[1].length + '>' + inline(h[2]) + '</h' + h[1].length + '>'); i++; continue; }
    if (/^\s*[-*]\s+/.test(l)) {
      var items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) { items.push('<li>' + inline(lines[i].replace(/^\s*[-*]\s+/, '')) + '</li>'); i++; }
      out.push('<ul>' + items.join('') + '</ul>'); continue;
    }
    if (/^\s*\d+\.\s+/.test(l)) {
      var its = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) { its.push('<li>' + inline(lines[i].replace(/^\s*\d+\.\s+/, '')) + '</li>'); i++; }
      out.push('<ol>' + its.join('') + '</ol>'); continue;
    }
    if (!l.trim()) { i++; continue; }
    var p = [];
    while (i < lines.length && lines[i].trim() && !/^```|^\s*\||^#{2,3}\s|^\s*[-*]\s+|^\s*\d+\.\s+/.test(lines[i])) { p.push(lines[i]); i++; }
    out.push('<p>' + inline(p.join(' ')) + '</p>');
  }
  return out.join('\n');
};
