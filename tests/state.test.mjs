import test from 'node:test';
import assert from 'node:assert/strict';
import {newData,validateData,loadData,answerMission,totalPoints,resetMission,storageKey,makePin} from '../state.js';

test('first correct answer earns points once; wrong answers are recorded without deductions',()=>{
  const before=newData();const m=before.missions[0];
  const wrong=answerMission(before,m.id,0).data;
  assert.equal(totalPoints(wrong),0);assert.equal(wrong.attempts[m.id].wrong,1);
  const right=answerMission(wrong,m.id,m.correct).data;
  assert.equal(totalPoints(right),100);assert.equal(right.attempts[m.id].correct,1);
  assert.equal(totalPoints(answerMission(right,m.id,m.correct).data),100);
  assert.deepEqual(before.completed,[]);
});
test('parent preview does not mutate progress',()=>{
  const data=newData();const result=answerMission(data,'fire',1,true);
  assert.equal(result.correct,true);assert.equal(result.data,data);assert.equal(totalPoints(data),0);
});
test('custom points survive round trip and resetting one mission preserves the others',()=>{
  let data=newData();data.missions[0].points=250;
  data=answerMission(data,'fire',1).data;data=answerMission(data,'digital',2).data;
  const restored=validateData(JSON.parse(JSON.stringify(data)));
  assert.equal(totalPoints(restored),350);
  const reset=resetMission(restored,'fire');assert.equal(totalPoints(reset),100);assert.deepEqual(reset.completed,['digital']);
});
test('invalid backup fields and duplicated answers are rejected',()=>{
  const data=newData();data.missions[0].answers=['نفس الخيار','نفس الخيار','خيار آخر'];
  assert.throws(()=>validateData(data));
  assert.throws(()=>validateData({missions:[null]}));
  assert.throws(()=>answerMission(newData(),'fire',7));
});
test('corrupt saved data is protected and never silently overwritten',()=>{
  let writes=0;const storage={getItem:()=>'{broken',setItem:()=>writes++};
  const result=loadData(storage);assert.ok(result.issue);assert.equal(writes,0);
});
test('migrates old progress and accepts v2 backups and empty mission lists',()=>{
  const storage={getItem:key=>key===storageKey?null:JSON.stringify({completed:['fire','fire','missing']})};
  const result=loadData(storage);assert.equal(totalPoints(result.data),100);
  const empty=newData();empty.missions=[];assert.equal(validateData(empty).missions.length,0);
  assert.equal(validateData(newData()).missions.length,6);
});
test('PIN digest stays compatible with previous SHA-256 salt scheme',async()=>{
  const value=await makePin('1234','00112233445566778899aabbccddeeff');
  assert.equal(value.length,64);assert.notEqual(value,'1234');
  assert.equal(value,await makePin('1234','00112233445566778899aabbccddeeff'));
});
test('reserved object keys cannot be imported as mission IDs',()=>{
  for(const id of ['__proto__','constructor','prototype']){
    const data=newData();data.missions[0].id=id;assert.throws(()=>validateData(data));
  }
});
