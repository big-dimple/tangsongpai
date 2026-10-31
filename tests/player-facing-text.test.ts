import {expect,it,vi} from 'vitest';
import {normalizeTextSetter,playerTextValue} from '../src/game/PlayerFacingText';
import {playerText} from '../src/game/Brand';

it('distinguishes base chips from accumulated and target scores without changing identifiers',()=>{
 expect(playerText('基础热度 +20，累计热度 × 倍率')).toBe('基础筹码 +20，累计筹码 × 倍率');
 expect(playerText('本场累计热度 80 / 目标热度 100')).toBe('本场累计得分 80 / 目标分数 100');
 expect(playerText('已过关场次累计热度、已入账累计热度、出牌前已经累计的热度')).toBe('已过关场次累计得分、已入账累计得分、出牌前已经累计的得分');
 expect(playerText('金币 / stage.heat / targetHeat / 热度纸')).toBe('金币 / stage.heat / targetHeat / 筹码纸');
 expect(playerText('热+20 · 读热10 · 蓄热 · 每张+8热')).toBe('筹+20 · 读筹10 · 蓄筹 · 每张+8筹');
 expect(playerText('逐牌加热')).toBe('逐牌加筹');
});

it('normalizes display strings and arrays without changing technical IDs or the source array',()=>{
 const rows=['牺牲1张唐宋牌','唐宋牌能力','tangsongpai / jokerScore / S07'];
 expect(playerTextValue(rows)).toEqual(['牺牲1张唐宋牌','唐宋牌能力','tangsongpai / jokerScore / S07']);
 expect(rows[0]).toBe('牺牲1张唐宋牌');expect(playerTextValue('唐宋牌')).toBe('唐宋牌');
});

it('guards every text creation/update through the shared setter and preserves receiver and chaining',()=>{
 class Text {value:unknown='';setText(value:string|string[]){this.value=value;return this;}}
 const original=Text.prototype.setText,stop=normalizeTextSetter(Text.prototype);
 expect(normalizeTextSetter(Text.prototype)).toBe(stop);
 const a=new Text(),b=new Text();expect(a.setText('唐宋牌')).toBe(a);expect(a.value).toBe('唐宋牌');
 b.setText(['唐宋牌槽','唐宋牌奖励']);expect(b.value).toEqual(['唐宋牌槽','唐宋牌奖励']);expect(a.value).toBe('唐宋牌');
 stop();expect(Text.prototype.setText).toBe(original);
});

it('leaves numeric/null runtime inputs and callback ownership to the original renderer',()=>{
 const original=vi.fn(function(this:{setText:unknown},value:unknown){return {owner:this,value};}),target={setText:original};
 const stop=normalizeTextSetter(target);
 expect(target.setText(null as unknown as string)).toEqual({owner:target,value:null});
 expect(target.setText(3 as unknown as string)).toEqual({owner:target,value:3});
 stop();expect(target.setText).toBe(original);
});
