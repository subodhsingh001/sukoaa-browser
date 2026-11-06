// SPDX-License-Identifier: GPL-3.0-or-later
const test=require('node:test'),assert=require('node:assert/strict');
const {addressSuggestions}=require('../desktop/address-suggestions.js');
test('suggestions match visited titles, URL prefixes and bookmarks, with duplicates removed',()=>{
 const history=[{url:'https://www.youtube.com/watch?v=1',title:'Music video'},{url:'https://example.com/docs',title:'YouTube guide'},{url:'https://www.youtube.com/watch?v=1',title:'Duplicate'}];
 const result=addressSuggestions('youtube',history,[{url:'https://example.org/',title:'YouTube tools'}]);
 assert.equal(result.length,3);assert.equal(result[0].value,history[0].url);
 assert(result.some(row=>row.label.startsWith('Bookmark · ')));
});
test('previous search terms come from known search providers; private pages have no history suggestions',()=>{
 const history=[{url:'https://www.google.com/search?q=learn+react',title:'learn react - Google Search'}];
 assert.equal(addressSuggestions('learn',history)[0].value,'learn react');
 assert.deepEqual(addressSuggestions('learn',history,[],true),[]);
 assert.equal(addressSuggestions('learn',history,[{url:'https://example.com/',title:'Learn React'}],true).length,1);
});
test('unsafe URLs are excluded, suggestions are bounded and clearing history removes visits',()=>{
 const rows=[{url:'javascript:alert(1)'},{url:'file:///tmp/private'},{url:'https://user:password@example.com/'}];
 assert.deepEqual(addressSuggestions('',rows),[]);
 const history=Array.from({length:20},(_,i)=>({url:`https://example.com/${i}`,title:`Page ${i}`}));
 assert.equal(addressSuggestions('',history).length,8);
 assert.deepEqual(addressSuggestions('',[]),[]);
 const title='<img src=x onerror=alert(1)>';
 assert.equal(addressSuggestions('example',[{url:'https://example.com/',title}])[0].label,title);
});
