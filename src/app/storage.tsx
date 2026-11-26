import { useAppTheme, type ThemeMode } from '@/providers/theme';
import { Redirect, router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { matchesStorage, storageValue, type StorageNorm } from '@/lib/storage-rules';
import { fetchStorageNorms, storageError } from '@/lib/storage-api';
import { useAuth } from '@/providers/auth';
const makeThemeC = (bmMode: ThemeMode) => ({ bg:(bmMode === 'light' ? '#FFFFFF' : '#151518'), panel:(bmMode === 'light' ? '#F5F5F5' : '#222226'), border:(bmMode === 'light' ? '#DDDDDD' : '#38383F'), text:(bmMode === 'light' ? '#111111' : '#F5F3F0'), muted:(bmMode === 'light' ? '#666666' : '#ADAAB4'), accent:(bmMode === 'light' ? '#B00020' : '#E8969B') });
const themeCacheC = { dark: makeThemeC('dark'), light: makeThemeC('light') };
const getThemeC = (mode: ThemeMode) => themeCacheC[mode];

export default function StorageScreen() {
  const { mode: bmMode } = useAppTheme();
  const C = getThemeC(bmMode);
  const s = getThemes(bmMode);

  const { staff, session, loading: authLoading } = useAuth();
  const [query,setQuery] = useState('');
  const [category,setCategory] = useState('');
  const [rows,setRows] = useState<StorageNorm[]>([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const [revision,setRevision] = useState(0);
  useFocusEffect(useCallback(()=>{
    // Retry and account changes must refetch; no persistent cache of staff data.
    void revision;
    if (!session?.user.id || !staff) return;
    let active = true;
    const controller = new AbortController();
    const timer = setTimeout(()=>controller.abort(),25000);
    setLoading(true);setError('');setRows([]);
    fetchStorageNorms(supabase,controller.signal).then(items=>{if(active)setRows(items);})
      .catch(err=>{if(active)setError(storageError(err));})
      .finally(()=>{clearTimeout(timer);if(active)setLoading(false);});
    return ()=>{active=false;clearTimeout(timer);controller.abort();};
  },[session?.user.id,staff,revision]));
  const groups=useMemo(()=>[...new Set(rows.map(item=>item.category).filter((value):value is string=>!!value))],[rows]);
  const shown=useMemo(()=>rows.filter(item=>(!category||item.category===category)&&matchesStorage(item,query)),[rows,category,query]);
  const refresh=()=>setRevision(v=>v+1);
  if(authLoading)return <View style={[s.screen,s.center]}><ActivityIndicator color={C.text}/></View>;
  if(!staff)return <Redirect href="/"/>;
  return <SafeAreaView style={s.screen}>
    <View style={s.bar}><Pressable accessibilityRole="button" accessibilityLabel="Назад" style={s.touch} onPress={()=>router.canGoBack()?router.back():router.replace('/home')}><Text style={s.buttonText}>‹ Назад</Text></Pressable><Text style={s.eyebrow}>СПРАВОЧНИК БАРА</Text></View>
    <View style={s.heading}><Text style={s.title}>Нормы хранения</Text><Text style={s.muted}>Сроки, температура и условия хранения</Text></View>
    <View style={s.search}><TextInput style={s.input} accessibilityLabel="Поиск по продукту и условиям хранения" placeholder="Продукт или способ хранения" placeholderTextColor={C.muted} value={query} onChangeText={setQuery} autoCorrect={false} returnKeyType="search"/>
      {!!query&&<Pressable accessibilityRole="button" accessibilityLabel="Очистить поиск" style={s.touch} onPress={()=>setQuery('')}><Text style={s.buttonText}>×</Text></Pressable>}
    </View>
    {!!groups.length&&<View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.groups}>
      {['',...groups].map(group=><Pressable key={group} accessibilityRole="button" accessibilityState={{selected:category===group}} onPress={()=>setCategory(group)} style={[s.chip,category===group&&s.selected]}><Text style={s.buttonText}>{group||'Все'}</Text></Pressable>)}
    </ScrollView></View>}
    <View style={s.tools}><Text style={s.eyebrow}>{loading?'ЗАГРУЗКА…':error?'НЕ УДАЛОСЬ ЗАГРУЗИТЬ':`ПОЗИЦИЙ: ${shown.length}`}</Text><Pressable accessibilityRole="button" disabled={loading} onPress={refresh} style={[s.touch,loading&&{opacity:0.4}]}><Text style={s.link}>Обновить</Text></Pressable></View>
    {loading?<View style={s.center}><ActivityIndicator color={C.text}/><Text style={s.muted}>Загружаем нормы хранения…</Text></View>:error?<View style={s.message}><Text style={s.body}>{error}</Text><Pressable accessibilityRole="button" style={s.touch} onPress={refresh}><Text style={s.link}>Повторить</Text></Pressable></View>:
      <FlatList data={shown} keyExtractor={item=>String(item.id)} contentContainerStyle={s.list} keyboardShouldPersistTaps="handled" refreshing={false} onRefresh={refresh}
        ListEmptyComponent={<View style={s.card}><Text style={s.body}>{rows.length?'По вашему запросу ничего не найдено.':'Доступных норм хранения пока нет. Таблица может быть пустой или доступ к записям ещё не настроен.'}</Text><Pressable accessibilityRole="button" style={s.touch} onPress={()=>{if(rows.length){setQuery('');setCategory('');}else refresh();}}><Text style={s.link}>{rows.length?'Сбросить фильтры':'Обновить'}</Text></Pressable></View>}
        ListHeaderComponent={<StorageTableHeader/>}
        stickyHeaderIndices={[0]}
        renderItem={({item,index})=><StorageCard item={item} index={index}/>}/>
    }
  </SafeAreaView>;
}
function StorageTableHeader() {
  const { mode } = useAppTheme();
  const s = getThemes(mode);

  return (
    <View style={s.tableHeader}>
      <Text style={[s.columnName,s.columnLabel]}>Наименование</Text>
      <Text style={[s.columnLife,s.columnLabel]}>Срок</Text>
      <Text style={[s.columnTemp,s.columnLabel]}>Темп.</Text>
      <Text style={[s.columnConditions,s.columnLabel]}>
        Условия хранения
      </Text>
    </View>
  );
}

function StorageCard({item,index}:{
  item:StorageNorm;
  index:number;
}) {
  const { mode } = useAppTheme();
  const s = getThemes(mode);

  return (
    <View style={[s.tableRow,index%2===1&&s.alternateRow]}>
      <View style={s.tableCells}>
        <View style={s.columnName}>
          <Text style={s.product}>
            {storageValue(item.product_name,'Без названия')}
          </Text>
          {!!item.category&&(
            <Text style={s.categoryText}>{item.category}</Text>
          )}
        </View>

        <Text style={[s.columnLife,s.value]}>
          {storageValue(item.shelf_life)}
        </Text>

        <Text style={[s.columnTemp,s.body]}>
          {storageValue(item.temperature)}
        </Text>

        <Text selectable style={[s.columnConditions,s.body]}>
          {storageValue(item.storage_conditions)}
        </Text>
      </View>

      {!!item.notes?.trim()&&(
        <Text selectable style={s.note}>
          Примечание: {item.notes}
        </Text>
      )}
    </View>
  );
}
const makeThemes=(bmMode: ThemeMode) => StyleSheet.create({
  tableHeader:{
    flexDirection:'row',
    alignItems:'center',
    backgroundColor:getThemeC(bmMode).panel,
    paddingHorizontal:8,
    paddingVertical:9,
    borderBottomWidth:1,
    borderColor:getThemeC(bmMode).border,
    gap:6,
    zIndex:10,
  },
  tableRow:{
    paddingHorizontal:8,
    paddingVertical:8,
    marginBottom:5,
    borderWidth:1,
    borderRadius:6,
    borderColor:bmMode==='light'?'#D5D5DA':'#424249',
    backgroundColor:bmMode==='light'?'#FFFFFF':'#222226',
  },
  tableCells:{
    flexDirection:'row',
    alignItems:'center',
    gap:6,
  },
  alternateRow:{
    backgroundColor:bmMode==='light'?'#F5F5F7':'#29292F',
  },
  columnName:{flex:1.4,minWidth:0},
  columnLife:{flex:0.75,minWidth:0},
  columnTemp:{flex:0.85,minWidth:0},
  columnConditions:{flex:1.2,minWidth:0},
  columnLabel:{
    color:getThemeC(bmMode).muted,
    fontSize:10,
    fontWeight:'700',
  },
  categoryText:{
    color:getThemeC(bmMode).muted,
    fontSize:10,
    lineHeight:13,
    marginTop:2,
  },
  note:{
    color:getThemeC(bmMode).muted,
    fontSize:11,
    lineHeight:15,
    marginTop:7,
    paddingTop:6,
    borderTopWidth:1,
    borderTopColor:bmMode==='light'?'#DDDDDD':'#38383F',
  },

  screen:{flex:1,backgroundColor:getThemeC(bmMode).bg},center:{padding:30,alignItems:'center',justifyContent:'center',gap:16},bar:{paddingHorizontal:12,paddingVertical:2,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},touch:{paddingVertical:8,paddingHorizontal:8},buttonText:{color:getThemeC(bmMode).text,fontSize:14,fontWeight:'600'},eyebrow:{color:getThemeC(bmMode).muted,fontSize:11,letterSpacing:0.7},heading:{paddingHorizontal:12,paddingTop:2,paddingBottom:10,gap:3},title:{color:getThemeC(bmMode).text,fontSize:23,fontWeight:'700'},muted:{color:getThemeC(bmMode).muted,fontSize:12,lineHeight:19},search:{marginHorizontal:12,flexDirection:'row',alignItems:'center',backgroundColor:getThemeC(bmMode).panel,borderRadius:12,borderWidth:1,borderColor:getThemeC(bmMode).border},input:{flex:1,color:getThemeC(bmMode).text,padding:9,minHeight:40,fontSize:13},groups:{paddingHorizontal:12,paddingTop:8,gap:5},chip:{paddingHorizontal:10,paddingVertical:7,borderRadius:10,borderWidth:1,borderColor:getThemeC(bmMode).border,backgroundColor:getThemeC(bmMode).panel},selected:{backgroundColor:(bmMode === 'light' ? '#F5F5F5' : '#413035'),borderColor:(bmMode === 'light' ? '#D99BA1' : '#C45C63')},tools:{paddingLeft:12,paddingRight:8,flexDirection:'row',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap'},link:{color:getThemeC(bmMode).accent,fontSize:13,fontWeight:'600'},list:{paddingHorizontal:8,paddingTop:0,paddingBottom:16},card:{backgroundColor:getThemeC(bmMode).panel,borderRadius:14,padding:18,gap:10,borderWidth:1,borderColor:getThemeC(bmMode).border},product:{fontSize:13,lineHeight:17,color:getThemeC(bmMode).text,fontWeight:'600'},body:{color:getThemeC(bmMode).text,fontSize:12,lineHeight:17},metrics:{flexDirection:'row',flexWrap:'wrap',gap:12,marginVertical:4},metric:{flexGrow:1,flexBasis:130,padding:12,backgroundColor:(bmMode === 'light' ? '#F5F5F5' : '#2D2D33'),borderRadius:10,gap:7},label:{color:getThemeC(bmMode).muted,fontSize:10,letterSpacing:0.8,marginTop:3},value:{color:getThemeC(bmMode).accent,fontSize:12,lineHeight:17,fontWeight:'600'},message:{margin:20,gap:12},
});
const themeCaches = { dark: makeThemes('dark'), light: makeThemes('light') };
const getThemes = (mode: ThemeMode) => themeCaches[mode];

