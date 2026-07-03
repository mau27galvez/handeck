export type DictCustomization = {
  line: string;
  reason: string;
};

/**
 * Local dictionary entries that fill known gaps in CC-CEDICT without modifying
 * the downloaded cedict_ts.u8 file. Each line is parsed through the normal
 * CEDICT parser so derived pinyin fields stay consistent with upstream entries.
 */
export const DICT_CUSTOMIZATIONS: DictCustomization[] = [
  {
    line: "新媒體 新媒体 [[xin1mei2ti3]] /new media; refers to digital forms of media that rely on the internet or modern information technology/",
    reason: "HSK 7-9 word with no standalone CC-CEDICT entry.",
  },
  {
    line: "新能源 新能源 [[xin1neng2yuan2]] /new energy; renewable energy/",
    reason: "HSK 7-9 word with no standalone CC-CEDICT entry.",
  },
  {
    line: "不予 不予 [[bu4yu3]] /to refuse to; to withhold; not to grant/",
    reason: "HSK 7-9 word with no standalone CC-CEDICT entry.",
  },
  {
    line: "精彩紛呈 精彩纷呈 [[jing1cai3fen1cheng2]] /(idiom) splendid and varied; full of brilliant highlights/",
    reason: "HSK 7-9 idiom with no standalone CC-CEDICT entry.",
  },
  {
    line: "居於 居于 [[ju1yu2]] /to occupy (a position); to rank (among)/",
    reason: "HSK 7-9 word with no standalone CC-CEDICT entry.",
  },
  {
    line: "口哨兒 口哨儿 [[kou3shao4r5]] /whistle; whistling/erhua form of 口哨[kou3shao4]/",
    reason: "HSK 7-9 erhua word; CC-CEDICT only has non-erhua 口哨.",
  },
  {
    line: "兩翼 两翼 [[liang3yi4]] /both wings; both flanks/",
    reason: "HSK 7-9 word with no standalone CC-CEDICT entry.",
  },
  {
    line: "壓軸 压轴 [[ya1zhou4]] /star item (traditionally the penultimate act) of a performance; grand finale/",
    reason: "HSK 7-9 word; CC-CEDICT only has the longer compound 压轴戏.",
  },
  {
    line: "致力於 致力于 [[zhi4li4yu2]] /to devote oneself to; to be committed to/",
    reason: "HSK 7-9 word; CC-CEDICT only has the shorter base form 致力.",
  },
  {
    line: "標識 标识 [[biao1shi2]] /mark; sign; symbol; identifier; to mark; to label/",
    reason: "HSK 7-9 biāoshí reading; CC-CEDICT only has biao1zhi4 as a variant of 标志.",
  },
];
