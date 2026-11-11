/* 六爻排盘核验。只读 liuyao.html 里的计算，不改页面结构。
   运行：node liuyao-audit.test.js
*/
var fs = require('fs');
var vm = require('vm');
var path = require('path');
var html = fs.readFileSync(path.join(__dirname, 'liuyao.html'), 'utf8');
var failed = 0;
function assert(cond, msg) {
  if (!cond) { failed++; console.error('FAIL ' + msg); }
}
function extract(id) {
  var re = new RegExp('<script id="' + id + '"[^>]*>([\\s\\S]*?)</script>');
  var m = html.match(re);
  if (!m) throw new Error('missing ' + id);
  return m[1];
}
function loadFactory(id) {
  var ctx = { module: { exports: {} }, exports: {}, self: {}, require: require, console: console };
  vm.createContext(ctx);
  vm.runInContext(extract(id), ctx, { filename: id });
  return ctx.module.exports;
}
var DATA = JSON.parse(extract('liuyao-data'));
var C = loadFactory('liuyao-core')(DATA);
var Z = loadFactory('liuyao-zs')(C);
var RZS = JSON.parse(extract('liuyao-rules-zs'));
var BH = loadFactory('liuyao-bh')(C, Z, RZS);

function T(s) {
  var m = /^(\d+)-(\d+)-(\d+) (\d+):(\d+):(\d+)$/.exec(s);
  return { y: +m[1], mo: +m[2], d: +m[3], h: +m[4], mi: +m[5], s: +m[6] };
}
function pillars(s, opt) { return C.pillars(T(s), opt || {}); }
function pillarStr(p) { return p.year + '年 ' + p.month + '月 ' + p.day + '日 ' + p.hour + '时 空' + p.kong.join(''); }

// 日干支与时支必须能按五鼠遁互起：时干 = 日干×2 + 时支
function wuxuOk(p) {
  var dg = '甲乙丙丁戊己庚辛壬癸'.indexOf(p.day[0]);
  var hz = '子丑寅卯辰巳午未申酉戌亥'.indexOf(p.hour[1]);
  var hs = '甲乙丙丁戊己庚辛壬癸'.indexOf(p.hour[0]);
  return hs === (dg * 2 + hz) % 10;
}

// ---------- 1. 时间 ----------
var pA = pillars('2026-11-10 22:49:00');
assert(pillarStr(pA) === '丙午年 己亥月 戊子日 癸亥时 空午未', '用例A四柱 ' + pillarStr(pA));
assert(pillarStr(pillars('2026-11-10 22:55:00')) === pillarStr(pA), '用例B同时辰四柱相同');
assert(wuxuOk(pA), '用例A五鼠遁');

// 0点换日：23:00 日柱不进，子时仍用当日日干。戊日子时为壬子，不是甲子。
var p23 = pillars('2026-11-10 23:00:00');
assert(p23.day === '戊子' && p23.hour === '壬子' && p23.kong.join('') === '午未', '0点换日 23:00 应为戊子日壬子时，实为 ' + p23.day + p23.hour);
assert(wuxuOk(p23), '23:00 五鼠遁与日柱一致');
var p2359 = pillars('2026-11-10 23:59:59');
assert(p2359.day === '戊子' && p2359.hour === '壬子', '23:59 仍为当日壬子时');
// 00:00 才换日。己日子时为甲子。
var p00 = pillars('2026-11-11 00:00:00');
assert(p00.day === '己丑' && p00.hour === '甲子' && p00.kong.join('') === '午未', '00:00 己丑日甲子时 ' + p00.day + p00.hour);
assert(wuxuOk(p00), '00:00 五鼠遁');
// 23点换日：日柱、时干、旬空一起进到次日
var pZi = pillars('2026-11-10 23:00:00', { ziSwitch23: true });
assert(pZi.day === '己丑' && pZi.hour === '甲子' && wuxuOk(pZi), '23点换日 23:00 日时同进 ' + pZi.day + pZi.hour);
// 旬尾：癸巳日 23:00 不换日则仍空午未、时干壬；换日则甲午日空辰巳
var pXun = pillars('2026-11-15 23:30:00');
assert(pXun.day === '癸巳' && pXun.hour === '壬子' && pXun.kong.join('') === '午未', '旬尾 0点换日 ' + pXun.day + pXun.hour + pXun.kong.join(''));
var pXun2 = pillars('2026-11-15 23:30:00', { ziSwitch23: true });
assert(pXun2.day === '甲午' && pXun2.hour === '甲子' && pXun2.kong.join('') === '辰巳', '旬尾 23点换日 ' + pXun2.day + pXun2.kong.join(''));
assert(wuxuOk(pXun) && wuxuOk(pXun2), '旬尾五鼠遁');

// 立春交节改年柱、月柱，不改日柱
var lc0 = pillars('2026-02-04 04:02:07'), lc1 = pillars('2026-02-04 04:02:08');
assert(lc0.year === '乙巳' && lc0.month === '己丑' && lc0.day === '己酉', '立春前一秒 ' + pillarStr(lc0));
assert(lc1.year === '丙午' && lc1.month === '庚寅' && lc1.day === '己酉' && lc1.hour === '丙寅', '立春当秒 ' + pillarStr(lc1));
assert(wuxuOk(lc0) && wuxuOk(lc1), '立春五鼠遁');
// 立春落在子时：年、月按交节改，日柱按 0点换日不改，时干跟日柱
var lcZ0 = pillars('2017-02-03 23:34:03'), lcZ1 = pillars('2017-02-03 23:34:04');
assert(lcZ0.year === '丙申' && lcZ0.month === '辛丑' && lcZ0.day === '辛酉' && lcZ0.hour === '戊子', '2017立春前 ' + pillarStr(lcZ0));
assert(lcZ1.year === '丁酉' && lcZ1.month === '壬寅' && lcZ1.day === '辛酉' && lcZ1.hour === '戊子', '2017立春子时日柱不进 ' + pillarStr(lcZ1));
assert(wuxuOk(lcZ0) && wuxuOk(lcZ1), '立春子时五鼠遁');
// 另一个交节：立冬改月不改年、不改日
var ld0 = pillars('2026-11-07 17:52:04'), ld1 = pillars('2026-11-07 17:52:05');
assert(ld0.year === '丙午' && ld0.month === '戊戌' && ld0.day === '乙酉', '立冬前 ' + pillarStr(ld0));
assert(ld1.year === '丙午' && ld1.month === '己亥' && ld1.day === '乙酉' && ld1.hour === '乙酉', '立冬当秒 ' + pillarStr(ld1));
// 惊蛰
var jz0 = pillars('2026-03-05 21:58:59'), jz1 = pillars('2026-03-05 21:59:00');
assert(jz0.month === '庚寅' && jz1.month === '辛卯' && jz0.day === jz1.day && jz0.year === '丙午', '惊蛰只换月 ' + jz0.month + '→' + jz1.month);

// 节气表按时间排序，交节用 <= 落到新节
var jie = DATA.jie, sorted = true;
for (var i = 1; i < jie.length; i++) if (jie[i][1] <= jie[i - 1][1]) sorted = false;
assert(sorted, '节气表按时间递增');
assert(jie.some(function (x) { return x[0] === '立春' && x[1] === '2026-02-04 04:02:08'; }), '2026立春时刻');
assert(jie.some(function (x) { return x[0] === '立冬' && x[1] === '2026-11-07 17:52:05'; }), '2026立冬时刻');

// 旬空来自日柱。这一天年柱丙午属甲辰旬空寅卯，月柱己亥属甲午旬空辰巳，与日空午未都不同。
assert(pA.kong.join('') === '午未', '旬空取日柱');
assert(pA.year === '丙午' && pA.month === '己亥', '年月柱不是旬空来源');

// 已知锚点：2000-01-01 戊午
assert(pillars('2000-01-01 12:00:00').day === '戊午', '2000-01-01 日柱');
// 抽样：任意日的 0–23 点，时柱都能由当日日干起出
var sampleDays = ['2026-01-01', '2026-02-03', '2026-06-15', '2026-11-15', '2033-02-03'];
sampleDays.forEach(function (day) {
  for (var h = 0; h < 24; h++) {
    var p = pillars(day + ' ' + (h < 10 ? '0' : '') + h + ':30:00');
    assert(!p.error && wuxuOk(p), '五鼠遁 ' + day + ' ' + h + ' ' + (p.day || '') + (p.hour || '') + (p.error || ''));
    var zhi = '子丑寅卯辰巳午未申酉戌亥'[(Math.floor((h + 1) / 2) % 12)];
    assert(p.hour[1] === zhi, '时支 ' + h + ' 应为' + zhi + ' 实为' + p.hour);
  }
});

// ---------- 2–8. 装卦 ----------
var NAJIA = {
  乾: ['甲子', '甲寅', '甲辰', '壬午', '壬申', '壬戌'],
  坎: ['戊寅', '戊辰', '戊午', '戊申', '戊戌', '戊子'],
  艮: ['丙辰', '丙午', '丙申', '丙戌', '丙子', '丙寅'],
  震: ['庚子', '庚寅', '庚辰', '庚午', '庚申', '庚戌'],
  巽: ['辛丑', '辛亥', '辛酉', '辛未', '辛巳', '辛卯'],
  離: ['己卯', '己丑', '己亥', '己酉', '己未', '己巳'],
  坤: ['乙未', '乙巳', '乙卯', '癸丑', '癸亥', '癸酉'],
  兌: ['丁巳', '丁卯', '丁丑', '丁亥', '丁酉', '丁未']
};
Object.keys(NAJIA).forEach(function (k) {
  var bits = DATA.tri[k].bits + DATA.tri[k].bits;
  var lines = C.najiaLines(bits);
  NAJIA[k].forEach(function (gz, i) {
    assert(lines[i].gan + lines[i].zhi === gz, k + ' 纳甲 ' + i + ' ' + lines[i].gan + lines[i].zhi);
  });
});
// 内外卦交叉：地火明夷 = 离下坤上
var ming = C.najiaLines('101000');
assert(['己卯', '己丑', '己亥', '癸丑', '癸亥', '癸酉'].every(function (g, i) { return ming[i].gan + ming[i].zhi === g; }), '明夷纳甲');
var wu = C.najiaLines('100111');
assert(['庚子', '庚寅', '庚辰', '壬午', '壬申', '壬戌'].every(function (g, i) { return wu[i].gan + wu[i].zhi === g; }), '无妄纳甲');

// 八宫：64 卦不重复，世应、游魂归魂与通行京房次序一致
var ORDER = ['八純', '一世', '二世', '三世', '四世', '五世', '遊魂', '歸魂'];
var SHI = [6, 1, 2, 3, 4, 5, 4, 3];
var EXPECT_PALACE = {
  乾: ['乾', '姤', '遯', '否', '觀', '剝', '晉', '大有'],
  震: ['震', '豫', '解', '恆', '升', '井', '大過', '隨'],
  坎: ['坎', '節', '屯', '既濟', '革', '豐', '明夷', '師'],
  艮: ['艮', '賁', '大畜', '損', '睽', '履', '中孚', '漸'],
  坤: ['坤', '復', '臨', '泰', '大壯', '夬', '需', '比'],
  巽: ['巽', '小畜', '家人', '益', '无妄', '噬嗑', '頤', '蠱'],
  離: ['離', '旅', '鼎', '未濟', '蒙', '渙', '訟', '同人'],
  兌: ['兌', '困', '萃', '咸', '蹇', '謙', '小過', '歸妹']
};
var byBits = {};
DATA.guas.forEach(function (g) { byBits[g.bits] = g.name; });
assert(Object.keys(C.PALACE).length === 64, '八宫应覆盖 64 卦');
Object.keys(EXPECT_PALACE).forEach(function (pal) {
  EXPECT_PALACE[pal].forEach(function (name, k) {
    var bits = Object.keys(C.PALACE).filter(function (b) { return byBits[b] === name; })[0];
    var info = C.PALACE[bits];
    assert(info && info.palace === pal && info.stage === ORDER[k] && info.shi === SHI[k], name + ' 宫位 ' + (info && (info.palace + info.stage + info.shi)));
    assert(info.ying === (info.shi + 2) % 6 + 1, name + ' 应爻');
  });
});

var SHEN_WU = ['勾陳', '螣蛇', '白虎', '玄武', '青龍', '朱雀']; // 戊日，初→上
function lineBrief(l) {
  return l.posName + ' ' + l.shen + ' ' + l.qin + ' ' + l.gan + l.zhi + l.wx + ' ' + (l.yang ? '阳' : '阴') + (l.moving ? '动' : '静') + (l.shi ? '世' : '') + (l.ying ? '应' : '') + (l.bian ? ' 化' + l.bian.qin + l.bian.gan + l.bian.zhi + l.bian.wx : '');
}

// 用例 A：地火明夷之泰，二爻阴动
var rA = C.build([7, 6, 7, 8, 8, 8], T('2026-11-10 22:49:00'), {});
assert(rA.ben.fullName === '地火明夷' && rA.bian.fullName === '地天泰', 'A 卦名');
assert(rA.palace.palace === '坎' && rA.palace.wx === '水' && rA.palace.stage === '遊魂' && rA.palace.shi === 4 && rA.palace.ying === 1, 'A 宫世应');
assert(JSON.stringify(rA.moving) === '[1]', 'A 动爻');
assert(C.PALACE[rA.changedBits].palace === '坤' && C.PALACE[rA.changedBits].stage === '三世', 'A 变宫');
assert(lineBrief(rA.lines[1]) === '二 螣蛇 官鬼 己丑土 阴动 化子孫甲寅木', 'A 二爻 ' + lineBrief(rA.lines[1]));
// 化出六亲按本宫水（子孙），不按变卦坤宫土（那会变成官鬼）
assert(rA.lines[1].bian.qin === '子孫', 'A 化出六亲用本宫');
assert(C.liuqin('土', '木') === '官鬼', '对照：若误用变宫，甲寅木会是官鬼');
rA.lines.forEach(function (l, i) { assert(l.shen === SHEN_WU[i], 'A 六神 ' + i); });
assert(rA.lines[3].shi && rA.lines[0].ying && !rA.lines[1].shi && !rA.lines[1].ying, 'A 世四应初');
var fuA = rA.lines.filter(function (l) { return l.fu; });
assert(fuA.length === 1 && fuA[0].fu.qin === '妻財' && fuA[0].fu.gan + fuA[0].fu.zhi === '戊午' && fuA[0].posName === '三', 'A 伏神 ' + JSON.stringify(fuA.map(function (l) { return l.posName + l.fu.qin + l.fu.gan + l.fu.zhi; })));
// 回头克只留在内部标记，下面复制文本不得写成定论
assert(rA.lines[1].bian.notes.indexOf('回頭剋') >= 0, 'A 内部仍可标回头克');

// 用例 B：天雷无妄之履
var rB = C.build([7, 6, 8, 7, 7, 7], T('2026-11-10 22:55:00'), {});
assert(rB.ben.fullName === '天雷无妄' && rB.bian.fullName === '天澤履', 'B 卦名');
assert(rB.palace.palace === '巽' && rB.palace.wx === '木' && rB.palace.stage === '四世' && rB.palace.shi === 4 && rB.palace.ying === 1, 'B 宫世应');
assert(JSON.stringify(rB.moving) === '[1]', 'B 动爻');
assert(C.PALACE[rB.changedBits].palace === '艮' && C.PALACE[rB.changedBits].stage === '五世', 'B 变宫');
assert(lineBrief(rB.lines[1]) === '二 螣蛇 兄弟 庚寅木 阴动 化兄弟丁卯木', 'B 二爻 ' + lineBrief(rB.lines[1]));
assert(rB.lines[1].bian.qin === '兄弟', 'B 化出仍按巽宫木，不是艮宫土的官鬼');
assert(C.liuqin('土', '木') === '官鬼', '对照变宫');
rB.lines.forEach(function (l, i) { assert(l.shen === SHEN_WU[i], 'B 六神 ' + i); });
assert(rB.lines.every(function (l) { return !l.fu; }), 'B 六亲俱全，无伏神');
assert(rB.lines[1].bian.notes.indexOf('化進神') >= 0, 'B 内部仍可标化进');

// 静卦
var rQ = C.build([7, 7, 7, 7, 7, 7], T('2026-11-10 22:49:00'), {});
assert(rQ.ben.name === '乾' && !rQ.bian && rQ.moving.length === 0, '静卦无变卦');
assert(rQ.palace.stage === '八純' && rQ.palace.shi === 6 && rQ.palace.ying === 3, '乾世应');
assert(rQ.lines.every(function (l) { return !l.fu && !l.moving; }), '乾六亲俱全且皆静');
assert(['子孫', '妻財', '父母', '官鬼', '兄弟'].every(function (q) { return rQ.lines.some(function (l) { return l.qin === q; }); }), '乾五亲齐全');

// 多动：化出纳甲、六亲仍按本宫；缺的六亲照旧伏
var rM = C.build([9, 6, 7, 8, 6, 8], T('2026-11-10 22:49:00'), {});
assert(rM.ben.fullName === '地火明夷' && rM.bian.fullName === '水風井', '多动变卦');
assert(JSON.stringify(rM.moving) === '[0,1,4]', '多动爻位');
assert(lineBrief(rM.lines[0]).indexOf('化官鬼辛丑土') >= 0, '多动初爻化出按坎宫 ' + lineBrief(rM.lines[0]));
assert(lineBrief(rM.lines[1]).indexOf('化兄弟辛亥水') >= 0, '多动二爻');
assert(lineBrief(rM.lines[4]).indexOf('化官鬼戊戌土') >= 0, '多动五爻');
assert(rM.lines[2].fu && rM.lines[2].fu.qin === '妻財' && rM.lines[2].fu.gan + rM.lines[2].fu.zhi === '戊午', '多动伏神仍在');
// 震宫看辛丑土是妻财；这里必须不是
assert(C.liuqin(C.PALACE[rM.changedBits].wx, '土') !== rM.lines[0].bian.qin, '化出六亲不等于变宫六亲');

// 六十四卦：缺的六亲恰好伏在本宫纯卦该爻下，不多不少；化出不算“已在本卦”
function auditFu(values) {
  var r = C.build(values, T('2026-11-10 12:00:00'), {});
  var present = {};
  r.lines.forEach(function (l) { present[l.qin] = 1; });
  var pure = DATA.tri[r.palace.palace].bits + DATA.tri[r.palace.palace].bits;
  C.najiaLines(pure).forEach(function (x, i) {
    var q = C.liuqin(r.palace.wx, x.wx);
    var fu = r.lines[i].fu;
    if (present[q]) assert(!fu, byBits[r.bits] + ' ' + q + ' 已上卦却标了伏神');
    else {
      assert(fu && fu.qin === q && fu.gan === x.gan && fu.zhi === x.zhi, byBits[r.bits] + ' 伏' + q + ' 位置错');
    }
  });
}
DATA.guas.forEach(function (g) {
  var still = g.bits.split('').map(function (b) { return b === '1' ? 7 : 8; });
  auditFu(still);
  var moved = still.slice();
  for (var i = 0; i < 6; i++) if (g.bits[i] === '0') { moved[i] = 6; break; }
  auditFu(moved);
});

// ---------- 复制文本 ----------
function chart(r, q, extra) {
  var qt = BH.qtype(Object.assign({ q: q }, extra || {}));
  return BH.chartLines(r, { q: q, time: '2026-11-10 22:49', zi23: false, bg: extra && extra.bg }, qt).join('\n');
}
var cA = chart(rA, '我女朋友的新工作能不能稳定下来？');
assert(cA.indexOf('【所问】我女朋友的新工作能不能稳定下来？') >= 0, '所问原文');
assert(cA.indexOf('【对象】以原问题为准\n') >= 0, '未指定对象不写成本人或涉及他人\n' + cA.split('\n')[1]);
assert(cA.indexOf('丙午年 己亥月 戊子日 癸亥时') >= 0 && cA.indexOf('旬空午未') >= 0 && cA.indexOf('0点换日') >= 0, '时间行');
assert(cA.indexOf('地火明夷之地天泰') >= 0 && cA.indexOf('坎宫水（游魂卦，变卦坤宫三世）') >= 0, '卦象宫');
assert(cA.indexOf('世四爻 应初爻') >= 0 && cA.indexOf('动爻：二') >= 0, '世应动爻');
assert(cA.indexOf('二爻 螣蛇 官鬼 己丑土 阴动 → 化子孙 甲寅木') >= 0, 'A 二爻复制');
assert(cA.indexOf('【伏神】妻财 戊午火 伏于三爻兄弟亥水下') >= 0, 'A 伏神复制');
assert(cA.indexOf('回头') < 0 && cA.indexOf('化进') < 0 && cA.indexOf('暗动') < 0, 'A 复制不含断语');
var yaoOrder = cA.split('\n').filter(function (x) { return /^(上|五|四|三|二|初)爻 /.test(x); }).map(function (x) { return x.slice(0, 2); });
assert(yaoOrder.join('') === '上爻五爻四爻三爻二爻初爻', '六爻自上而下 ' + yaoOrder.join(','));

var cB = chart(rB, '买五菱宏光MINI还是奔腾小马？');
assert(cB.indexOf('【所问】买五菱宏光MINI还是奔腾小马？') >= 0, 'B 所问原文');
assert(cB.indexOf('【对象】以原问题为准') >= 0 && cB.indexOf('本人') < 0, '买车题不写成本人');
assert(cB.indexOf('天雷无妄之天泽履') >= 0 && cB.indexOf('巽宫木（四世卦，变卦艮宫五世）') >= 0, 'B 卦象');
assert(cB.indexOf('二爻 螣蛇 兄弟 庚寅木 阴动 → 化兄弟 丁卯木') >= 0, 'B 二爻复制');
assert(cB.indexOf('【伏神】无') >= 0, 'B 无伏神要写明');
assert(cB.indexOf('化进') < 0 && cB.indexOf('进神') < 0, 'B 复制不含化进定论');

var cQ = chart(rQ, '这工作能不能稳定？');
assert(cQ.indexOf('（六爻安静）') >= 0 && cQ.indexOf('动爻：无') >= 0 && cQ.indexOf('【伏神】无') >= 0, '静卦复制');
assert(cQ.indexOf('【对象】以原问题为准') >= 0, '工作题对象不定');

var cM = chart(rM, '其他方案行不行？');
assert(cM.indexOf('涉及他人') < 0 && cM.indexOf('本人') < 0, '“其他”不误判成他人或本人');
assert(cM.indexOf('化官鬼 辛丑土') >= 0 && cM.indexOf('化兄弟 辛亥水') >= 0 && cM.indexOf('化官鬼 戊戌土') >= 0, '多动化出都写入');

var qtSelf = BH.qtype({ q: '我自己近期能否顺利', target: 'self' });
assert(BH.objLine(qtSelf) === '本人', '选定自己才写本人');
var qtWife = BH.qtype({ q: '她最近怎么样', target: 'spouseF' });
assert(BH.objLine(qtWife).indexOf('他人：') === 0 && BH.objLine(qtWife).indexOf('问卦人指定') >= 0, '选定他人照录 ' + BH.objLine(qtWife));
var qtHelp = BH.qtype({ q: '帮我问一下这工作稳不稳' });
assert(BH.objLine(qtHelp) === '以原问题为准', '“帮我问”不写成代他人');

// 背景原文、六步指令仍在，且不把吉凶写死在卦盘上
var ai = BH.aiText(rA, null, { q: '测试问题原文', bg: '补充：不是我自己', time: '2026-11-10 22:49', qt: BH.qtype({ q: '测试问题原文' }) });
assert(ai.indexOf('【所问】测试问题原文') >= 0 && ai.indexOf('【背景】补充：不是我自己') >= 0, '背景原文');
assert(ai.indexOf('审题取用') >= 0 && ai.indexOf('动变') >= 0 && ai.indexOf('【找病】') >= 0 && ai.indexOf('【找药】') >= 0 && ai.indexOf('【反证】') >= 0, '六步指令仍要求自行取用、看动变、权衡反证');
var chartPart = ai.split('【断卦指令】')[0];
assert(chartPart.indexOf('吉') < 0 && chartPart.indexOf('凶') < 0, '卦盘部分不预设吉凶');

if (failed) { console.error(failed + ' failed'); process.exit(1); }
console.log('ok');
