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
        renderItem={({item})=><StorageCard item={item}/>}/>
    }
  </SafeAreaView>;
}
function StorageCard({item}:{item:StorageNorm}) {
  const { mode: bmMode } = useAppTheme();
  const s = getThemes(bmMode);

  return <View style={s.card}>
    <Text style={s.eyebrow}>{storageValue(item.category,'Без категории')}</Text><Text style={s.product}>{storageValue(item.product_name,'Без названия')}</Text>
    <View style={s.metrics}><View style={s.metric}><Text style={s.label}>СРОК ХРАНЕНИЯ</Text><Text style={s.value}>{storageValue(item.shelf_life,'Срок не указан')}</Text></View><View style={s.metric}><Text style={s.label}>ТЕМПЕРАТУРА</Text><Text style={s.value}>{storageValue(item.temperature)}</Text></View></View>
    <Text style={s.label}>УСЛОВИЯ ХРАНЕНИЯ</Text><Text selectable style={s.body}>{storageValue(item.storage_conditions)}</Text>
    {!!item.notes?.trim()&&<><Text style={s.label}>ПРИМЕЧАНИЕ</Text><Text selectable style={s.body}>{item.notes}</Text></>}
  </View>;
}
const makeThemes=(bmMode: ThemeMode) => StyleSheet.create({
  screen:{flex:1,backgroundColor:getThemeC(bmMode).bg},center:{padding:30,alignItems:'center',justifyContent:'center',gap:16},bar:{paddingHorizontal:20,paddingVertical:8,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},touch:{paddingVertical:12,paddingHorizontal:8},buttonText:{color:getThemeC(bmMode).text,fontSize:14,fontWeight:'600'},eyebrow:{color:getThemeC(bmMode).muted,fontSize:11,letterSpacing:0.7},heading:{paddingHorizontal:22,paddingTop:8,paddingBottom:20,gap:8},title:{color:getThemeC(bmMode).text,fontSize:29,fontWeight:'700'},muted:{color:getThemeC(bmMode).muted,fontSize:12,lineHeight:19},search:{marginHorizontal:20,flexDirection:'row',alignItems:'center',backgroundColor:getThemeC(bmMode).panel,borderRadius:12,borderWidth:1,borderColor:getThemeC(bmMode).border},input:{flex:1,color:getThemeC(bmMode).text,padding:14,minHeight:52,fontSize:15},groups:{paddingHorizontal:20,paddingTop:14,gap:8},chip:{paddingHorizontal:14,paddingVertical:12,borderRadius:10,borderWidth:1,borderColor:getThemeC(bmMode).border,backgroundColor:getThemeC(bmMode).panel},selected:{backgroundColor:(bmMode === 'light' ? '#F5F5F5' : '#413035'),borderColor:(bmMode === 'light' ? '#D99BA1' : '#C45C63')},tools:{paddingLeft:22,paddingRight:14,flexDirection:'row',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap'},link:{color:getThemeC(bmMode).accent,fontSize:13,fontWeight:'600'},list:{padding:20,paddingTop:8,paddingBottom:30,gap:14},card:{backgroundColor:getThemeC(bmMode).panel,borderRadius:14,padding:18,gap:10,borderWidth:1,borderColor:getThemeC(bmMode).border},product:{fontSize:20,lineHeight:27,color:getThemeC(bmMode).text,fontWeight:'600'},body:{color:getThemeC(bmMode).text,fontSize:14,lineHeight:22},metrics:{flexDirection:'row',flexWrap:'wrap',gap:12,marginVertical:4},metric:{flexGrow:1,flexBasis:130,padding:12,backgroundColor:(bmMode === 'light' ? '#F5F5F5' : '#2D2D33'),borderRadius:10,gap:7},label:{color:getThemeC(bmMode).muted,fontSize:10,letterSpacing:0.8,marginTop:3},value:{color:getThemeC(bmMode).text,fontSize:18,fontWeight:'600'},message:{margin:20,gap:12},
});
const themeCaches = { dark: makeThemes('dark'), light: makeThemes('light') };
const getThemes = (mode: ThemeMode) => themeCaches[mode];

