////////////////////////
//File  : cocolog_ajax_search.js
//site  : http://java.cocolog-nifty.com/
//author: naoyuki
//year  : 2006
//この作品は、クリエイティブ・コモンズの帰属-同一条件許諾 2.1 日本ライセンスの下でライセンスされています。この使用許諾条件を見るには、http://creativecommons.org/licenses/by-sa/2.1/jp/をチェックするか、クリエイティブ･コモンズに郵便にてお問い合わせください。住所は：559 Nathan Abbott Way, Stanford, California 94305, USA です。
////////////////////////

var page_counter = 0;
var backnumber_url_list = new Array();
var entries = new Array();
var matched_url = new Array();
var search_keyword;
var result_content;
var search_counter;
var result_data;
var is_lookahead = true;

var bs_cc_as_current_page = 1;
var bs_cc_as_last_page = 1;
var bs_cc_as_per_page = 10;
var bs_cc_as_notice = '';
var bs_cc_as_search_keywords;

//document.write('<img src="http://weblog.news.coocan.jp/projects/etc/cocolog_ajax_search_users_log.cgi?u=' + encodeURIComponent(location.href) + '" width="1" height="1" alt="" />');

load_center_id();
set_lookahead_action();

function isOriginalTemplate(){
        try{
                if(document.body.className.search(/^layout/) != -1) {
                        return true;
                } else {
                        return false;
                }
        }catch(ex){
                return false;
        }
}

function load_center_id() {
        if(isOriginalTemplate()){
                var center = document.getElementById( 'beta-inner' );
        }else{
                var center = document.getElementById( 'center' );
        }
    if ( center ) {
        ligting_search_keyword( center );
    } else {
        window.setTimeout( 'load_center_id()', 100 );
    }
}

function set_lookahead_action() {
        var search_box = document.getElementById('search_box');
        try {
                search_box.onfocus = function () {
                        setTimeout("lookahead_backnumbers();", 100);
                }
        } catch(e) {
                setTimeout("set_lookahead_action();", 100 );
        }
}

function ligting_search_keyword( center ) {
    var args = getHashArgs();
    var searched_keyword = args.search_word;
    if ( searched_keyword ) {
        searched_keyword = searched_keyword.replace( /([\/\\\.\*\+\?\|\(\)\[\]\{\}\$\^])/g, "\\$1" );
        searched_keyword = searched_keyword.replace( /( +|　+)/, ' ' );
        searched_keyword = searched_keyword.replace( /( |　)$/, '' );
        var keywords = searched_keyword.split(/ |　/);
        var h3 = center.getElementsByTagName( 'h3' );
        h3[0].innerHTML = highlight( h3[0].innerHTML, keywords );
        var div = center.getElementsByTagName( 'div' );
        for ( var i = 0; i < div.length; i++ ) {
            if ( div[i].className == 'entry-body' ) {
                replace_text_only(div[i], keywords);
            }
        }
    }
}

function getHashArgs () {
    var args = new Object();
    var query = location.href.replace(/.*?#/,"");
   query = decodeURIComponent( query );
    var pairs = query.split("&");
    for ( var i = 0; i < pairs.length; i++ ) {
        var pos = pairs[i].indexOf('=');
        if ( pos == -1 ) continue;
        var argname = pairs[i].substring( 0, pos );
        var value = pairs[i].substring( pos + 1 );
        args[argname] = value;
    }
    return args;
}

function lookahead_backnumbers() {
        if(is_lookahead) {
                is_lookahead = false;
                search_keyword = '';
                search_counter = 0;
                var archive_file_path = getArchiveFilePath();
                if(isOriginalTemplate()){
                        result_content = document.getElementById('beta-inner');
                }else{
                        var div_tag = document.getElementsByTagName('div');
                        for ( var i = 0; i < div_tag.length; i ++ ) {
                                if ( div_tag[i].className == 'content' ) {
                                        result_content = div_tag[i];
                                }
                        }
                }
                new Ajax( archive_file_path, {method: 'get', onComplete: function(responseText){ parse_backnumbers( responseText ); } } ).request();
        }
}

function cocologAjaxSearch( archive_file_path, text ) {
    search_keyword = text;
    search_counter = 0;
    bs_cc_as_current_page = 1;
    bs_cc_as_last_page = 1;
    result_data = new Array();
        matched_url = new Array();
//    search_keyword = search_keyword.replace( /([\/\\\.\*\+\?\|\(\)\[\]\{\}\$\^])/g, "\\$1" );
    search_keyword = search_keyword.replace( /( +|　+)/, ' ' );
    search_keyword = search_keyword.replace( /( |　)$/, '' );
    window.scroll(0,0);
    var div_tag = document.getElementsByTagName('div');
    for ( var i = 0; i < div_tag.length; i ++ ) {
        if ( div_tag[i].className == 'content' ) {
            result_content = div_tag[i];
        }
    }
    new Ajax( getArchiveFilePath(), {method: 'get', onComplete: function(responseText){ parse_backnumbers( responseText ); } } ).request();
}

function parse_backnumbers( responseText ) {
        if(isOriginalTemplate()){
                var backnumber_page = responseText;
                var tmp_element = document.createElement('div');
                tmp_element.innerHTML = responseText;
                var div_elements = tmp_element.getElementsByTagName('div');
                var archive_a_tags = new Array();
                for(var i=0; i<div_elements.length; i++){
                        if(div_elements[i].className == 'archive-date-based archive'){
                                a_tags = div_elements[i].getElementsByTagName('a');
                                for(var j=0; j<a_tags.length; j++){
                                        backnumber_url_list[j] = a_tags[j].href;
                                }
                        }
                }
        }else{
                var backnumber_page = responseText;
                backnumber_page = backnumber_page.replace( new RegExp( '\n', "g"), '' );
                backnumber_page = backnumber_page.replace( new RegExp( '\r', "g"), '' );
                backnumber_page = backnumber_page.replace( new RegExp( '.*(<div class="archive-datebased">.*?<div class="archive-category">).*', "i"), "$1" );
                backnumber_url_list = backnumber_page.match(/http:\/\/.*?html/ig);
                for(var i=0; i<backnumber_url_list.length; i++){
                        backnumber_url_list[i] = backnumber_url_list[i].match(/http:\/\/[^\/]+(\/.*)/i)[1];
                }
        }
        load_backnumber();
}

function load_backnumber() {
    if( page_counter > backnumber_url_list.length - 1 ) {
        search();
    } else {
        new Ajax( backnumber_url_list[ page_counter ], {method: 'get', onComplete: function(responseText){ parse_enteries_page( responseText ); } } ).request();
    }
}

function parse_enteries_page( responseText ) {
        if(isOriginalTemplate()){
                var tmp_element = document.createElement('div');
                tmp_element.innerHTML = responseText.replace( new RegExp( '\n', "g"), '' ).replace( new RegExp( '\r', "g"), '' ).replace(new RegExp('<script.*?<\/script>', 'ig'), '').replace(new RegExp('onload=".*?"', 'ig'), '');
                var div_tags = tmp_element.getElementsByTagName('div');
                var entry_list = new Array();
                for(var i=0; i<div_tags.length; i++){
                        if(div_tags[i].className == 'entry'){
                                entry_list.push(div_tags[i]);
                        }
                }
                for ( var i = 0; i < entry_list.length; i++ ) {
                        var title = entry_list[i].getElementsByTagName('a')[0].innerHTML;
                        var link = entry_list[i].getElementsByTagName('a')[0].href;
                        var body = '';
                        var tmp_tags = entry_list[i].getElementsByTagName('div');
                        for(var j=0; j<tmp_tags.length; j++){
                                if(tmp_tags[j].className == 'entry-body'){
                                        body = tmp_tags[j].innerHTML;
                                }
                        }

                        body = body.replace( new RegExp( '<.*?>', 'ig'), '' );
                        title = title.replace( new RegExp( '<.*?>', 'ig'), '' );
                        entries[ entries.length ] = {title:title, body:body, link:link};
                }
        }else{
                var entries_page = responseText;
                entries_page = entries_page.replace( new RegExp( '\n', "g"), '' );
                entries_page = entries_page.replace( new RegExp( '\r', "g"), '' );
                entry_list = entries_page.match(/<div class="entry">.*?<\/div><div class="entry-bottom"><\/div>/ig);
                for ( var i = 0; i < entry_list.length; i++ ) {
                        entry_list[i].match(/.*<h3>(.*?)<\/h3>.*<div class="entry-body-text">(.*?)<div class="entry-body-bottom"><\/div>.*<a class="permalink" href="(.*?)">.*/i);
                        var title = RegExp.$1;
                        var body = RegExp.$2;
                        var link = RegExp.$3;
                        body = body.replace( new RegExp( '<.*?>', 'ig'), '' );
                        title = title.replace( new RegExp( '<.*?>', 'ig'), '' );
                        entries[ entries.length ] = {title:title, body:body, link:link};
                }
        }
    search();
    page_counter++;
    load_backnumber();
}

function show_all_backnumbers() {
    var text = '<ol type=1 start=1 style="text-align:left;">';
    for ( var i = 0; i < entries.length; i++ ) {
        text += '<li><a href="' + entries[i].link + '">' +entries[i].title + '</a</li>';
    }
    text += '</ol>';
    document.getElementById('center').innerHTML = text;
}

function search() {
    var is_hit = false;
    if ( search_keyword == '' ) {
    } else {
    var keywords = search_keyword.split(/ |　/);
    for ( var i=search_counter; i<entries.length; i++ ) {
        var is_match = true;
        for ( var j= 0; j<keywords.length; j++ ) {
            var body_index = entries[i].body.toLowerCase().indexOf( keywords[j].toLowerCase() );
            var title_index = entries[i].title.toLowerCase().indexOf( keywords[j].toLowerCase() );
            if ( body_index == -1 && title_index == -1 ) {
                is_match = false;
            }
        }
        if ( is_match ) {
                if(!matched_url[entries[i].link]){
                        result_data[ result_data.length ] = entries[i];
                        is_hit = true;
                        matched_url[entries[i].link] = true;
                }
        }
        search_counter++;
    }
    var result_html = '';
    var search_notice = '';
    if ( result_data.length == 0 ) {
        if ( page_counter > backnumber_url_list.length - 1 ) {
                result_html =  '一致しませんでした';
                is_hit = true;
        } else {
                result_content.innerHTML = '検索中... ' + Math.floor( ( page_counter * 100 )  / backnumber_url_list.length )  + '%';
                return;
        }
    } else {
        if ( page_counter > backnumber_url_list.length - 1 ) {
                search_notice = '検索結果（' + result_data.length + '件ヒット)';
                result_html = build_search_result_html( result_data, keywords, search_notice );
        } else {
                search_notice = '検索中...' + Math.floor( ( page_counter * 100 )  / backnumber_url_list.length ) + '%（' + result_data.length + '件ヒット)';
                result_html = build_search_result_html( result_data, keywords, search_notice);
        }
    }
    var div = window.document.getElementsByTagName('div');
    if(is_hit){
        result_content.innerHTML = result_html;
    } else {
        document.getElementsByTagName('h3')[0].innerHTML = search_notice;
    }
  }
}

function build_search_result_html( result_data, keywords, notice ) {
    bs_cc_as_notice = notice;
    bs_cc_as_search_keywords = keywords;
    var start_index = (bs_cc_as_current_page - 1) * bs_cc_as_per_page;
    var last_index = result_data.length;

    var page_navigation = '';
    page_navigation += '<center><div style="margin: 5px;">';
    if(bs_cc_as_current_page > 1){
        page_navigation += ' <a href="javascript:change_page(' + (bs_cc_as_current_page - 1) + ')">＜前へ</a> ';
    }
    for ( var i=0; i<(result_data.length / bs_cc_as_per_page); i++) {
        if(i+1 == bs_cc_as_current_page){
            page_navigation += ' ' + (i + 1) + ' ';
        } else {
            page_navigation += ' <a href="javascript:change_page(' + (i + 1) + ')">' + (i + 1) + '</a> ';
        }
    }
    if(bs_cc_as_current_page < (result_data.length / bs_cc_as_per_page)){
        page_navigation += ' <a href="javascript:change_page(' + (bs_cc_as_current_page + 1) + ')">次へ＞</a> ';
    }
    page_navigation += '</div></center>';

    var html = '<div id="search_notice"  style="text-align:left; font-size: x-small;">※スペースでAND検索が出来ます。<br />※この状態からの２度目の検索は非常に高速です。</div><div class="entry-top"></div><div class="entry"><h3>' + notice +'</h3><div class="entry-body-top"></div><div class="entry-body"><div class="entry-body-text"><ol type=1 start=' + (start_index+1) + ' style="text-align:left;">';
    html += page_navigation;
    if(((bs_cc_as_current_page) * bs_cc_as_per_page) < result_data.length){
        last_index = (bs_cc_as_current_page) * bs_cc_as_per_page;
    }
    for ( var i= start_index; i<last_index; i++ ) {
        html += '<li><a href="' + result_data[i].link + '#search_word=' + search_keyword + '" target="_blank">' + highlight( result_data[i].title, keywords ) + '</a><br />' + highlight( trunc( result_data[i].body, keywords[0] ), keywords ) + '</li>';
    }
    html += '</ol>';
    html += page_navigation;
    html += '</div></div><div class="entry-body-bottom"></div><p class="posted" style="text-align:right; font-size: smaller;"><span class="post-footers"></span><span class="separator"></span><span class="bo_so_copyright">powered by <a href="http://java.cocolog-nifty.com/blog/2005/10/javascript_c163.html">cocolog_ajax_search.js</a></span></p></div><div class="entry-bottom"></div><div class="date-footer"></div>';
    return html;
}

function change_page(new_page) {
    window.scroll(0,0);
    bs_cc_as_current_page = new_page;
    result_content.innerHTML = build_search_result_html( result_data, bs_cc_as_search_keywords, bs_cc_as_notice );
}

function trunc( text, keyword ) {
    var key = new RegExp( keyword, "i" );
    var res = key.exec( text );

    if ( res ) {
        var index  = res.index;
        var length = res[0].length;
        var start;
        var end;

        start = index - 20;
        end = 55;
        text = text.substring( start, index ) + text.substr( index, length ) + text.substr( index + length, end ) +'...';
    } else {
        text = text.substring( start, 50 );
    }
    return text;
}

function highlight( text, keywords ) {
    var keyword = '';
    for ( var i= 0; i<keywords.length; i++ ) {
        if ( i == keywords.length - 1 ) {
            keyword += encodeURIComponent(keywords[i]);
        } else {
            keyword += encodeURIComponent(keywords[i]) + '|'; 
        }
    }
    replaced_text = encodeURIComponent(text).replace( new RegExp( '(' + keyword + ')', "ig"), '<span style="background-color: #FFCC33;">' + "$1" + '</span>' );
    return decodeURIComponent(replaced_text);
}

function replace_text_only(node_target, keywords) {
    var keyword = '';
    for ( var i= 0; i<keywords.length; i++ ) {
        if ( i == keywords.length - 1 ) {
            keyword += encodeURIComponent(keywords[i]);
        } else {
            keyword += encodeURIComponent(keywords[i]) + '|'; 
        }
    }
    var nodes = getTextNodes(node_target);
    var reg = new RegExp(keyword, "i");
    var node;
    var text;
    for(var i=0; i<nodes.length; i++) {
        node = nodes[i];
        text = node.nodeValue;
        text = encodeURIComponent(text);
        if(text.match(reg)) {
            while(text.match(reg)) {
                var res = text.match(reg);
                //              node.parentNode.insertBefore(node.ownerDocument.createTextNode(decodeURIComponent(RegExp.leftContext)), node);
                node.parentNode.insertBefore(node.ownerDocument.createTextNode(decodeURIComponent( text.substring(0, res.index))), node);
                var span = node.ownerDocument.createElement("span");
                span.style.backgroundColor = "#FFCC33";
                //              node.parentNode.insertBefore(span, node).appendChild(node.ownerDocument.createTextNode(decodeURIComponent(RegExp.lastMatch)));
                node.parentNode.insertBefore(span, node).appendChild(node.ownerDocument.createTextNode(decodeURIComponent(res[0])));
                //              text = RegExp.rightContext;
                text = text.substring(res.index + res[0].length, text.length);
            }
            node.parentNode.insertBefore(node.ownerDocument.createTextNode(decodeURIComponent(text)), node);
            node.parentNode.removeChild(node);
        }
    }
}

function getTextNodes(node) {
    function setTextNodes(node, list_text) {
        if(node.nodeType == null)
            return;     
        switch(node.nodeType) {
        case 3:
            list_text.push(node);                                       
            break;
        case 1:
        case 9:
            var nodes = node.childNodes;
            for(var i=0; i<nodes.length; i++)
                setTextNodes(nodes[i], list_text);
            break;
        default:
            break;
        }
    }
    var list_text = new Array();
    setTextNodes(node, list_text);
    return list_text;
}

function getArchiveFilePath() {
        var archives_url = document.getElementsByTagName('h1')[0].getElementsByTagName('a')[0].href + 'archives.html';
        return archives_url.match(/http:\/\/[^\/]+(\/.*)/i)[1];
}
