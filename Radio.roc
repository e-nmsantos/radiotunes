Station : {
	id : U64,
	name : Str,
	stream_url : Str,
	genre : Str,
	country : Str,
	favorite : Bool,
	in_library : Bool,
	bit_rate : U32,
}

StationList : List(Station)

AdvancedFilter : {
	query : Str,
	country : Str,
	city : Str,
	genre : Str,
	min_bitrate : U32,
	only_favorites : Bool,
	only_in_library : Bool,
}

CustomPlaylist : {
	id : U64,
	name : Str,
	icon : Str,
	station_ids : List(U64),
}

CustomCategory : {
	id : Str,
	name : Str,
	icon : Str,
}

ScheduledRecording : {
	station_id : U64,
	start_time : Str,
	duration_mins : U32,
	is_active : Bool,
}

TrackHistoryItem : {
	title : Str,
	artist : Str,
	station_id : U64,
}

EqualizerPreset : {
	name : Str,
	bass : I32,
	mid : I32,
	treble : I32,
}

SleepTimer : {
	seconds_left : U64,
	is_active : Bool,
}

AlarmConfig : {
	hour : U8,
	minute : U8,
	station_id : U64,
	is_enabled : Bool,
}

PlaybackState : {
	current_station_id : U64,
	is_playing : Bool,
	volume : U8,
	is_muted : Bool,
	sleep_timer : SleepTimer,
	alarm : AlarmConfig,
}

## Cria uma nova estação de rádio
create_station : U64, Str, Str, Str, Str, U32 -> Station
create_station = |id, name, stream_url, genre, country, bit_rate| {
	id,
	name,
	stream_url,
	genre,
	country,
	favorite: Bool.False,
	in_library: Bool.True,
	bit_rate,
}

## Alterna o estado de favorito de uma estação
toggle_favorite : StationList, U64 -> StationList
toggle_favorite = |stations, target_id| {
	List.map(
		stations,
		|station| {
			if station.id == target_id {
				new_fav =
					if station.favorite == Bool.True {
						Bool.False
					} else {
						Bool.True
					}
				{ ..station, favorite: new_fav }
			} else {
				station
			}
		},
	)
}

## Inclui ou exclui uma estação da biblioteca pessoal do utilizador
toggle_library_inclusion : StationList, U64 -> StationList
toggle_library_inclusion = |stations, target_id| {
	List.map(
		stations,
		|station| {
			if station.id == target_id {
				new_inc =
					if station.in_library == Bool.True {
						Bool.False
					} else {
						Bool.True
					}
				{ ..station, in_library: new_inc }
			} else {
				station
			}
		},
	)
}

## Atribui uma estação de rádio a uma nova categoria ou género musical
assign_station_category : StationList, U64, Str -> StationList
assign_station_category = |stations, target_id, new_category| {
	List.map(
		stations,
		|station| {
			if station.id == target_id {
				{ ..station, genre: new_category }
			} else {
				station
			}
		},
	)
}

## Cria e adiciona uma nova categoria personalizada
create_custom_category : List(CustomCategory), Str, Str, Str -> List(CustomCategory)
create_custom_category = |categories, id, name, icon| {
	List.append(categories, { id, name, icon })
}

## Elimina ou remove uma estação de rádio da lista ativa
delete_station : StationList, U64 -> StationList
delete_station = |stations, target_id| {
	List.drop_if(stations, |s| s.id == target_id)
}

## Filtro avançado por múltiplos critérios
apply_advanced_filter : StationList, AdvancedFilter -> StationList
apply_advanced_filter = |stations, filter| {
	List.keep_if(
		stations,
		|s| {
			matches_query =
				filter.query == ""
					or Str.contains(s.name, filter.query)
						or Str.contains(s.country, filter.query)
							or Str.contains(s.genre, filter.query)

			matches_country =
				filter.country == ""
					or filter.country == "Todos"
						or Str.contains(s.country, filter.country)

			matches_genre =
				filter.genre == ""
					or filter.genre == "Todas"
						or Str.contains(s.genre, filter.genre)

			matches_bitrate = s.bit_rate >= filter.min_bitrate

			matches_fav =
				filter.only_favorites == Bool.False
					or s.favorite == Bool.True

			matches_lib =
				filter.only_in_library == Bool.False
					or s.in_library == Bool.True

			matches_query
				and matches_country
					and matches_genre
						and matches_bitrate
							and matches_fav
								and matches_lib
		},
	)
}

## Cria uma playlist personalizada
create_playlist : U64, Str, Str -> CustomPlaylist
create_playlist = |id, name, icon| {
	id,
	name,
	icon,
	station_ids: [],
}

## Adiciona uma estação a uma playlist
add_to_playlist : CustomPlaylist, U64 -> CustomPlaylist
add_to_playlist = |playlist, station_id| {
	if List.contains(playlist.station_ids, station_id) {
		playlist
	} else {
		{ ..playlist, station_ids: List.append(playlist.station_ids, station_id) }
	}
}

## Remove uma estação de uma playlist
remove_from_playlist : CustomPlaylist, U64 -> CustomPlaylist
remove_from_playlist = |playlist, station_id| {
	{ ..playlist, station_ids: List.keep_if(playlist.station_ids, |id| id != station_id) }
}

## Cria um agendamento de gravação (DVR)
create_scheduled_recording : U64, Str, U32 -> ScheduledRecording
create_scheduled_recording = |station_id, start_time, duration_mins| {
	station_id,
	start_time,
	duration_mins,
	is_active: Bool.True,
}

## Filtra estações por género musical ou categoria
filter_by_genre : StationList, Str -> StationList
filter_by_genre = |stations, target_genre| {
	if target_genre == "Todos" or target_genre == "Todas" {
		stations
	} else {
		List.keep_if(stations, |station| station.genre == target_genre)
	}
}

## Pesquisa estações por nome ou país
search_stations : StationList, Str -> StationList
search_stations = |stations, query| {
	if query == "" {
		stations
	} else {
		List.keep_if(
			stations,
			|station| {
				Str.contains(station.name, query)
					or Str.contains(station.country, query)
						or Str.contains(station.genre, query)
			},
		)
	}
}

## Devolve apenas as estações marcadas como favoritas
get_favorites : StationList -> StationList
get_favorites = |stations| {
	List.keep_if(stations, |station| station.favorite == Bool.True)
}

## Devolve apenas estações incluídas na biblioteca
get_library_stations : StationList -> StationList
get_library_stations = |stations| {
	List.keep_if(stations, |station| station.in_library == Bool.True)
}

## Obtém a estação seguinte na lista de forma cíclica
next_station_id : StationList, U64 -> U64
next_station_id = |stations, current_id| {
	total = List.len(stations)
	if total == 0 {
		0
	} else {
		match List.find_first_index(stations, |s| s.id == current_id) {
			Ok(idx) => {
				next_idx = (idx + 1) % total
				match List.get(stations, next_idx) {
					Ok(station) => station.id
					Err(_) => current_id
				}
			}
			Err(_) => {
				match List.first(stations) {
					Ok(first_station) => first_station.id
					Err(_) => 0
				}
			}
		}
	}
}

## Obtém a estação anterior na lista de forma cíclica
prev_station_id : StationList, U64 -> U64
prev_station_id = |stations, current_id| {
	total = List.len(stations)
	if total == 0 {
		0
	} else {
		match List.find_first_index(stations, |s| s.id == current_id) {
			Ok(idx) => {
				prev_idx = if idx == 0 {
					total - 1
				} else {
					idx - 1
				}
				match List.get(stations, prev_idx) {
					Ok(station) => station.id
					Err(_) => current_id
				}
			}
			Err(_) => {
				match List.last(stations) {
					Ok(last_station) => last_station.id
					Err(_) => 0
				}
			}
		}
	}
}

## Cria uma definição de preset para o equalizador
create_eq_preset : Str, I32, I32, I32 -> EqualizerPreset
create_eq_preset = |name, bass, mid, treble| {
	name,
	bass,
	mid,
	treble,
}

## Inicia um temporizador de sono (sleep timer) em minutos
start_sleep_timer : U64 -> SleepTimer
start_sleep_timer = |minutes| {
	if minutes == 0 {
		{ seconds_left: 0, is_active: Bool.False }
	} else {
		{ seconds_left: minutes * 60, is_active: Bool.True }
	}
}

## Decrementa 1 segundo do sleep timer e desliga quando chega a 0
tick_sleep_timer : SleepTimer -> SleepTimer
tick_sleep_timer = |timer| {
	if timer.is_active == Bool.False or timer.seconds_left == 0 {
		{ seconds_left: 0, is_active: Bool.False }
	} else if timer.seconds_left <= 1 {
		{ seconds_left: 0, is_active: Bool.False }
	} else {
		{ seconds_left: timer.seconds_left - 1, is_active: Bool.True }
	}
}

## Cria uma configuração de alarme/despertador
create_alarm : U8, U8, U64, Bool -> AlarmConfig
create_alarm = |hour, minute, station_id, is_enabled| {
	hour,
	minute,
	station_id,
	is_enabled,
}

## Verifica se o alarme deve tocar no minuto atual
should_trigger_alarm : AlarmConfig, U8, U8 -> Bool
should_trigger_alarm = |alarm, current_hour, current_minute| {
	alarm.is_enabled == Bool.True
		and alarm.hour == current_hour
			and alarm.minute == current_minute
}

## Exporta uma lista de estações para o formato padrão M3U
export_m3u : StationList -> Str
export_m3u = |stations| {
	header = "#EXTM3U\n"
	lines = List.map(
		stations,
		|s| {
			"#EXTINF:-1,${s.name} (${s.country})\n${s.stream_url}"
		},
	)
	body = Str.join_with(lines, "\n")
	"${header}${body}"
}

## Formata as informações de uma estação para texto
format_station : Station -> Str
format_station = |station| {
	fav_icon = if station.favorite == Bool.True {
		"⭐"
	} else {
		"☆"
	}
	id_str = Str.inspect(station.id)
	kbps_str = Str.inspect(station.bit_rate)
	"${fav_icon} #${id_str} [${station.genre}] ${station.name} (${station.country} - ${kbps_str} kbps)"
}

# ==============================================================================
# TESTES UNITÁRIOS (Executados com: roc test Radio.roc)
# ==============================================================================

# Teste 1: Criação de estações e contagem
expect {
	s1 = create_station(1, "Rádio Comercial", "https://stream.comercial.pt", "Pop", "Portugal", 128)
	s2 = create_station(2, "Antena 3", "https://stream.antena3.pt", "Alternativa", "Portugal", 128)
	s3 = create_station(3, "Jazz Radio", "https://stream.jazz.fr", "Jazz", "França", 192)

	radio_list : StationList
	radio_list = [s1, s2, s3]

	List.len(radio_list) == 3
}

# Teste 2: Favoritos
expect {
	s1 = create_station(1, "RFM", "https://stream.rfm.pt", "Pop", "Portugal", 128)
	s2 = create_station(2, "TSF", "https://stream.tsf.pt", "Notícias", "Portugal", 96)

	stations = [s1, s2]
	with_fav = toggle_favorite(stations, 1)

	favs = get_favorites(with_fav)
	List.len(favs) == 1
}

# Teste 3: Filtro por género
expect {
	s1 = create_station(1, "RFM", "https://stream.rfm.pt", "Pop", "Portugal", 128)
	s2 = create_station(2, "M80", "https://stream.m80.pt", "Rock 80s", "Portugal", 128)
	s3 = create_station(3, "Smooth FM", "https://stream.smooth.pt", "Jazz", "Portugal", 128)

	stations = [s1, s2, s3]
	jazz_stations = filter_by_genre(stations, "Jazz")

	List.len(jazz_stations) == 1
}

# Teste 4: Pesquisa por texto
expect {
	s1 = create_station(1, "Antena 1", "https://stream.antena1.pt", "Notícias", "Portugal", 128)
	s2 = create_station(2, "BBC Radio 1", "https://stream.bbc.co.uk", "Pop", "Reino Unido", 192)

	stations = [s1, s2]
	results = search_stations(stations, "BBC")

	List.len(results) == 1
}

# Teste 5: Navegação cíclica (Next / Prev)
expect {
	s1 = create_station(1, "Estação 1", "url1", "Pop", "PT", 128)
	s2 = create_station(2, "Estação 2", "url2", "Rock", "PT", 128)
	s3 = create_station(3, "Estação 3", "url3", "Jazz", "PT", 128)

	stations = [s1, s2, s3]

	next_from_1 = next_station_id(stations, 1)
	next_from_3 = next_station_id(stations, 3)
	prev_from_1 = prev_station_id(stations, 1)

	next_from_1 == 2
		and next_from_3 == 1
			and prev_from_1 == 3
}

# Teste 6: Presets de Equalizador
expect {
	bass_boost = create_eq_preset("Bass Boost", 8, -1, 3)
	vocal_boost = create_eq_preset("Voz", -3, 6, 2)

	bass_boost.bass == 8
		and bass_boost.name == "Bass Boost"
			and vocal_boost.mid == 6
}

# Teste 7: Sleep Timer
expect {
	timer30 = start_sleep_timer(30)
	timer_ticked = tick_sleep_timer(timer30)
	timer_off = start_sleep_timer(0)

	timer30.seconds_left == 1800
		and timer30.is_active == Bool.True
			and timer_ticked.seconds_left == 1799
				and timer_off.is_active == Bool.False
}

# Teste 8: Exportação para M3U
expect {
	s1 = create_station(1, "RFM", "https://stream.rfm.pt", "Pop", "Portugal", 128)
	s2 = create_station(2, "BBC 1", "https://stream.bbc.co.uk", "Pop", "UK", 192)

	m3u_output = export_m3u([s1, s2])
	Str.contains(m3u_output, "#EXTM3U")
		and Str.contains(m3u_output, "#EXTINF:-1,RFM (Portugal)")
			and Str.contains(m3u_output, "https://stream.rfm.pt")
}

# Teste 9: Configuração e ativação de Alarme / Despertador
expect {
	alarm7 = create_alarm(7, 30, 101, Bool.True)
	alarm_off = create_alarm(8, 0, 102, Bool.False)

	rings_at_7_30 = should_trigger_alarm(alarm7, 7, 30)
	no_ring_at_7_31 = should_trigger_alarm(alarm7, 7, 31)
	no_ring_when_off = should_trigger_alarm(alarm_off, 8, 0)

	rings_at_7_30 == Bool.True
		and no_ring_at_7_31 == Bool.False
			and no_ring_when_off == Bool.False
}

# Teste 10: Filtro Avançado e Inclusão na Biblioteca
expect {
	s1 = create_station(1, "Mega Hits Lisboa", "url1", "Pop Hits", "Portugal", 192)
	s2 = create_station(2, "Rock Antena", "url2", "Classic Rock", "Portugal", 96)
	s3 = create_station(3, "Jazz Paris", "url3", "Smooth Jazz", "França", 256)

	stations = [s1, s2, s3]

	filter : AdvancedFilter
	filter = {
		query: "",
		country: "Portugal",
		city: "",
		genre: "Pop",
		min_bitrate: 128,
		only_favorites: Bool.False,
		only_in_library: Bool.True,
	}

	filtered = apply_advanced_filter(stations, filter)
	List.len(filtered) == 1
}

# Teste 11: Criação e gestão de Playlists Personalizadas
expect {
	p1 = create_playlist(1, "Foco no Trabalho", "💼")
	p2 = add_to_playlist(p1, 101)
	p3 = add_to_playlist(p2, 201)
	p4 = remove_from_playlist(p3, 101)

	List.len(p3.station_ids) == 2
		and List.len(p4.station_ids) == 1
			and List.contains(p4.station_ids, 201)
}

# Teste 12: Gravação Agendada (DVR)
expect {
	rec = create_scheduled_recording(101, "08:00", 30)
	rec.station_id == 101
		and rec.duration_mins == 30
			and rec.is_active == Bool.True
}

# Teste 13: Criação de Categorias Personalizadas e Reatribuição de Rádio
expect {
	s1 = create_station(1, "Rádio Comercial", "url1", "Música", "Portugal", 128)
	updated_stations = assign_station_category([s1], 1, "Anos 90")
	matching_90s = filter_by_genre(updated_stations, "Anos 90")

	cats = [
		{ id: "cat_pop", name: "Pop", icon: "🎵" },
	]
	new_cats = create_custom_category(cats, "cat_90s", "Anos 90", "📻")

	List.len(matching_90s) == 1
		and List.len(new_cats) == 2
}

# Teste 14: Eliminar / Remover Estação de Rádio
expect {
	s1 = create_station(1, "Rádio 1", "url1", "Música", "Portugal", 128)
	s2 = create_station(2, "Rádio 2", "url2", "Rock", "Portugal", 128)
	remaining = delete_station([s1, s2], 1)

	List.len(remaining) == 1
		and List.contains(remaining, s2)
}


