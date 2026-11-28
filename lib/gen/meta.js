'use strict';
const { GH, readme } = require('./util');

const BRIEFS = [
  'Servers say more than the page shows. Look at the headers that come back with every reply from this site. One of them is not standard. Its name starts with X-Rootrank.',
  'This site has a message for people who open the browser console. Read it. It points you somewhere.',
  'Open the element inspector on the live page (view-source will not show it). One element is hidden from view and carries data in a data-s attribute. The data is encoded.',
  'The terminal knows a command that help does not list. It is named after this site. Run it, and decode what it prints.'
];
module.exports = [{
  id: 'signal', title: "Oracle's Beacon", cat: 'Signal', levels: 4, signal: true,
  tier: (lv) => (lv <= 1 ? 2 : lv <= 3 ? 3 : 4), type: 'site',
  blurb: 'Flags hidden in the site itself. Headers, console, page source, terminal.',
  brief: (lv) => BRIEFS[lv - 1],
  build: () => ({ motd: 'Nothing is hidden in this machine. The site itself is the target.', hosts: { main: { name: 'arena', files: readme('The flag for this level is not on this machine.\nIt is hidden in the website you are using.\nSubmit it here when you find it.') } } }),
  solve: () => ['help']
}];
