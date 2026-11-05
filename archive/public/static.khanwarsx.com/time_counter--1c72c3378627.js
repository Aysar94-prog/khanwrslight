function get_separated_time(aTime)
{
    var minute_const = 60;
    var hour_const = 60 * minute_const;
    var day_const = 240 * hour_const;

    var ret_time = new Array(4);
    ret_time[0] = Math.floor(aTime / day_const);
//    ret_time[1] = Math.floor((aTime % day_const) / hour_const);
    ret_time[1] = Math.floor(aTime / hour_const);
    ret_time[2] = Math.floor((aTime % hour_const) / minute_const);
    ret_time[3] = Math.floor(aTime % minute_const); //Tova ne znam zashto stava necqlo 4islo ot vreme na vreme?!?!? Trqbva da pogledna po-obstoino

    for (var i=0; i < ret_time.length; i++)
    {
      if (ret_time[i] < 10) ret_time[i] = '0' + ret_time[i];
    }

    return ret_time;
}


var quester_current_level=1;

function time_counter(url,broi,time_one,timer,para_id)
{
    //document.write(para_id);
    var bxx = document.getElementById(para_id);
    now = new Date();

    all_time = get_separated_time(timer);
    one_time = get_separated_time(time_one);

    text_time = one_time[1] + ':' + one_time[2] + ':' + one_time[3];
    //if (one_time[0] > 0) text_time = one_time[0] + (one_time > 1?' дни ':' ден ') + text_time;
    if (broi > 1)
    {
      text_time  = 'Текущ: ' + text_time;
      text_time += ' <br /> ';
      text_time += 'Общо: ' + (all_time[0] > 0?(all_time[0] + (all_time[0] > 1?' ??? ':' ??? ')):'') + all_time[1] + ':' + all_time[2] + ':' + all_time[3];
    }
    bxx.innerHTML = text_time;
    timer = timer - 1;
    time_one = time_one - 1;
    if (time_one <= 0 || timer <= 0) 
    {
        // 2.5 fast quester
        if (url=='AutocompleteQuester'){
            document.getElementById('buttonSkipQuest').disabled = false;
            document.getElementById('buttonSkipQuest').style.backgroundColor = '#4B2F15';
            document.getElementById('strSkipQuestMessage').innerHTML = '';
            bxx.innerHTML = '';
            /*
            AutocompleteQuester();
            if (quester_current_level<=20){
                window.setTimeout("time_counter('"+url+"',"+broi+","+quester_autocomplete_timeout+","+quester_autocomplete_timeout+",'"+para_id+"');",998);
            }
            */
        }// end fast quester
        else
            location.href = url;
    }
    else 
        window.setTimeout("time_counter('"+url+"',"+broi+","+time_one+","+timer+",'"+para_id+"');",998);
}

function count_down_timer()
{
	for (var timer_num=1; timer_num <= total_timers; timer_num++)
	{
		var currenttimer = document.getElementById('cnt_one['+timer_num+']');
		var timervalue = currenttimer.title;
		var currenttimer_all = document.getElementById('cnt_all['+timer_num+']');
		var timervalue_all = currenttimer_all.title;
		if (timervalue <= 0) 
		{
			timeractive = false;
			break;
		}
		var timertext = get_separated_time(timervalue);
		currenttimer.innerHTML = timertext[1]+':'+timertext[2]+':'+timertext[3];
		currenttimer.title = timervalue-1;
		timertext = get_separated_time(timervalue_all);
		currenttimer_all.innerHTML = timertext[1]+':'+timertext[2]+':'+timertext[3];
		currenttimer_all.title = timervalue_all-1;
	}
	if (timeractive == true)
	{
		window.setTimeout('count_down_timer()',1000-(total_timers*2));
	}
	else 
	{
		if (!loading)
		{
			loading = true;
			location.href = location.href;
		}
	}
}
