/*
 jq-cocolog_ajax_search.js - ココログ用全文検索 (jQuery 版)

 Copyright (c) 2015 furyu <furyutei@gmail.com>
 http://furyu.hatenablog.com/
 http://furyu.tea-nifty.com/annex/
 
 ライセンス： Creative Commons － 表示 - 継承 2.1 日本 － CC BY-SA 2.1 JP
 http://creativecommons.org/licenses/by-sa/2.1/jp/
 
 本スクリプトは、
 「自分のココログを全文検索するブログパーツ: 暴想」
 http://java.cocolog-nifty.com/blog/2005/10/javascript_c163.html
 のスクリプト[cocolog_ajax_search.js](http://java.cocolog-nifty.com/blog/files/javascript/cocolog_ajax_search.js)を元に、jQuery を用いて移植・改修を行ったものです。
 
----- オリジナルヘッダ -----
////////////////////////
//File  : cocolog_ajax_search.js
//site  : http://java.cocolog-nifty.com/
//author: naoyuki
//year  : 2006
//この作品は、クリエイティブ・コモンズの帰属-同一条件許諾 2.1 日本ライセンスの下でライセンスされています。この使用許諾条件を見るには、http://creativecommons.org/licenses/by-sa/2.1/jp/をチェックするか、クリエイティブ･コモンズに郵便にてお問い合わせください。住所は：559 Nathan Abbott Way, Stanford, California 94305, USA です。
////////////////////////
*/

(function() {

'use strict';

var $ = window.jQuery;

if ( ( ! $ ) || ( ! $.setHighlightColor ) ) {
    alert('jQuery もしくは必要なプラグインが読み込まれていません');
    return;
}

$(function() {

//{ ■ 定数
var SCRIPT_NAME = 'ココログ用全文検索',
    RELATED_URL = 'http://furyu.tea-nifty.com/annex/';
//}

//{ ■ オプション
var DEBUG = false,
    HIGHLIGHT_COLOR = '#ffcc33',
    TRUNCATION_LENGTH = 80,
    ENTRY_PER_PAGE = 20,
    MAX_CONCURRENT_LOAD = 3,
    DISPLAY_SEARCH_FORM = true,
    SEARCH_BOX_ID = 'search_box',
    SEARCH_CREDIT_ID = 'search_credit',
    SEARCH_CONTAINER_TEMPLATE = [
        '<form class="cocolog_ajax_search">'
    ,   '    <input type="search" name="search_box" value="" results="5" autosave="tangerine" placeholder="検索語を入力" />'
    ,   '    <input type="submit" value="検索" />'
    ,   '    <p style="font-size: x-small;">※スペースでAND検索が出来ます。</p>'
    ,   '</form>'
    ,   '<div class="entry-top"></div>'
    ,   '<div class="entry search-result-container">'
    ,   '    <h3 class="search-notice">検索準備中...</h3>'
    ,   '    <div class="entry-body-top"></div>'
    ,   '    <div class="entry-body">'
    ,   '        <div class="entry-body-text">'
    ,   '            <center><div class="page-navigation" style="margin: 5px;"></div></center>'
    ,   '            <ol class="search-result" type="1" start="1" style="text-align:left;">'
    ,   '            </ol>'
    ,   '            <center><div class="page-navigation" style="margin: 5px;"></div></center>'
    ,   '        </div>'
    ,   '    </div>'
    ,   '    <div class="entry-body-bottom"></div>'
    ,   '    <p class="posted" style="text-align:right; font-size: smaller;">'
    ,   '         <span class="post-footers"></span>'
    ,   '         <span class="separator"></span>'
    ,   '         <span class="copyright">powered by <a href=""></a></span>'
    ,   '         <a href="#" class="to_top_navigation" style="margin-left:16px;">上に戻る▲</a>'
    ,   '    </p>'
    ,   '</div>'
    ,   '<div class="entry-bottom"></div>'
    ,   '<div class="date-footer"></div>'
    ].join('\n');
//}


//{ ■ 共通変数
var is_lookahead = true,
    result_content = null,
    last_archive_file_path = null,
    requested_backnumber_counter = 0,
    loaded_backnumber_counter = 0,
    backnumber_list = [],
    backnumber_queue = [],
    backnumber_map = {},
    entries = [],
    search_keywords = [],
    search_counter = 0,
    matched_entry_map = {},
    result_data = [],
    current_page = 1;
//}


//{ ■ 関数
var debug_log = (function() {
    function zero_padding(num, len){
        return ('0000000000' + num).slice(-len);
    };
    
    function get_timestamp() {
        var date = new Date();
        return zero_padding(date.getHours(), 2) + ':' + zero_padding(date.getMinutes(), 2) + ':' + zero_padding(date.getSeconds(), 2) + '.' + zero_padding(date.getMilliseconds(), 3);
    };
    
    return function( string ) {
        if ( ! DEBUG ) {
            return;
        }
        console.log( '[' + get_timestamp() + ']', string );
    };
})(); // end of debug_log()


function trunc_spaces( string ) {
    return string.replace(/[\s\u3000]+/g, ' ').replace(/(^ | $)/g, '');
} // end of trunc_spaces()


function get_absolute_path( url ) {
    return trunc_spaces( url ).replace(/^https?:\/\/[^\/]+/i, '');
} // end of get_absolute_path()


function get_archive_file_path() {
    var archives_url = ( $('h1 a').first().attr('href') || '' ) + 'archives.html';
    return get_absolute_path( archives_url );
} // end of get_archive_file_path()


function is_original_template() {
    return / layout/.test( ' ' + ( $('body').first().attr('class') || '' ) + ' ' );
} // end of is_original_template()


function get_content_container( root ) {
    if ( ! root ) {
        root = $('body');
    }
    var content;
    
    if ( is_original_template() ) {
        content = root.find('#alpha-inner:has(div.entry),#beta-inner:has(div.entry),#gamma-inner:has(div.entry)').first();
    }
    else {
        content = root.find('#center div.content').first();
    }
    
    if ( content.size() < 1 ) {
        content = null;
    }
    return content;
} // end of get_content_container()


function get_args( query ) {
    var args = {},
        params= query.split('&');
    
    $.each(params, function( index, param ) {
        var pairs = param.split('=');
        if ( pairs.length < 2 ) {
            return;
        }
        var name = decodeURIComponent( pairs.shift() ),
            value = decodeURIComponent( pairs.join('=') );
        args[name] = value;
    });
    return args;
} // end of get_args()


function get_keywords( search_query ) {
    if ( Object.prototype.toString.call( search_query ) != '[object String]' ) {
        search_query = '';
    }
    search_query = trunc_spaces( search_query );
    
    var fragments = search_query.split(' '),
        keywords = [];
    
    $.each(fragments, function( index, fragment ) {
        if ( fragment ) {
            keywords.push( fragment );
        }
    });
    return keywords;
} // end of get_keywords()


function get_reg_keywords( keywords ) {
    var modified_keywords = [];
    
    $.each(keywords, function( index, keyword ) {
        keyword = keyword.replace(/[.*+?^$|,(){}[\]\-\/\\\s]/g, '\\$&');
        modified_keywords.push( keyword );
    });
    
    return new RegExp( '(' + modified_keywords.join('|') + ')', 'gi' );
} // end of get_reg_keywords()


var get_document = (function() {
    if ( ( document.implementation ) && ( document.implementation.createHTMLDocument ) ) {
        var html_doc = document.implementation.createHTMLDocument('');
    }
    else if ( typeof XSLTProcessor != 'undefined' ) {
        var proc = new XSLTProcessor(),
            xsltStyleSheet = new DOMParser().parseFromString([
                '<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="1.0">'
            ,       '<xsl:output method="html" />'
            ,       '<xsl:template match="/">'
            ,           '<html><head><title></title></head><body></body></html>'
            ,       '</xsl:template>'
            ,   '</xsl:stylesheet>'
            ].join(''), 'application/xml');
        proc.importStylesheet(xsltStyleSheet);
        var html_doc = proc.transformToDocument( xsltStyleSheet );
    }
    else {
        if ( typeof ActiveXObject != 'undefined' ) {
            return function( html ) {
                var html_doc = new ActiveXObject( 'htmlfile' );
                html_doc.designMode = 'on';
                html_doc.open( 'text/html' );
                html_doc.write( html );
                html_doc.close();
                
                return $(html_doc);
            };
        }
        else {
            function getInnerBody( html ) {
                return html.replace(/(^[\s\S]*?<body[^>]*>|<\/body>(?![\s\S]*<\/body>)[\s\S]*$)/gi, '');
            } // end of getInnerBody()
            
            return function( html ) {
                var page_body = $('<div/>').html( getInnerBody( html ) );
                return page_body;
            };
        }
    }
    var range = html_doc.createRange();
    
    return function( html ) {
        html = html.replace(/(^[\s\S]*?<html[^>]*>|<\/html[^>]*>(?![\s\S]*<\/html[^>]*>)[\s\S]*$)/gi, '');
        range.selectNodeContents( html_doc.documentElement );
        range.deleteContents();
        html_doc.documentElement.appendChild( range.createContextualFragment( html ) );
        
        return $(html_doc);
    };
})(); // end of get_document()


function get_simple_document( html ) {
    var html_doc = get_document( html );
    
    html_doc.find('script,style,iframe,img,object,embed,video,audio').remove();
    
    return html_doc;
} // end of get_simple_document()


function trunc_text( text, keywords ) {
    var text_length = text.length,
        reg_keywords = get_reg_keywords( keywords ),
        response = reg_keywords.exec( text );

    if ( response ) {
        var index  = response.index,
            length = response[0].length,
            prefix_length = Math.floor(TRUNCATION_LENGTH / 2),
            start;
        
        if (index < prefix_length) {
            prefix_length = index;
        }
        start = index - prefix_length;
        text = text.substr(start, length + TRUNCATION_LENGTH);
        
        if ( 0 < start ) {
            text = '...' + text;
        }
        if ( (start + length + TRUNCATION_LENGTH) < text_length ) {
            text += '...';
        }
    } 
    else {
        text = text.substr( 0, TRUNCATION_LENGTH );
        if ( TRUNCATION_LENGTH < text_length ) {
            text += '...';
        }
    }
    return text;
} // end of trunc_text()


var escape_html = (function(){
    var escape_map = {
            '&' : '&amp;'
        ,   '<' : '&lt;'
        ,   '>' : '&gt;'
        ,   '"' : '&quot;'
        ,   '`' : '&#x60;'
        ,   "'" : '&#x27;'
        },
        chars = [];
    
    for ( var char in escape_map ) {
        if ( escape_map.hasOwnProperty( char ) ) {
            chars.push( char );
        }
    }
    var reg_escape = new RegExp( '[' + chars.join('') + ']', 'g' );
    
    return function(html) {
        return html.replace(reg_escape, function( match ) {
            return escape_map[match];
        });
    };
})(); // end of escape_html()


function scroll_to_node_top( node ) {
    if ( ! node ) {
        return;
    }
    $('html,body').animate({scrollTop: node.offset().top - 32}, 'fast');
} // end of scroll_to_node_top()


function build_search_result_container() {
    result_content = get_content_container();
    if ( !result_content ) {
        alert('このサイトには対応していません');
        return;
    }
    result_content.addClass('search-result-container');
    
    var search_container = $('<div/>').html( SEARCH_CONTAINER_TEMPLATE ),
        search_form = search_container.find('form.cocolog_ajax_search'),
        search_box = search_form.find('input[name="search_box"]');
    
    search_container.find('span.copyright a').attr('href', RELATED_URL).text( SCRIPT_NAME );
    
    search_container.find('a.to_top_navigation').click(function() {
        scroll_to_node_top( result_content );
        return false;
    });
    
    search_box.val( search_keywords.join(' ') );
    
    search_form.submit(function () {
        cocologAjaxSearch( search_box.val() );
        return false;
    });
    
    if ( DISPLAY_SEARCH_FORM ) {
        search_form.show();
    }
    else {
        search_form.hide();
    }
    result_content.empty().append( search_container.contents() );
    
    if ( DISPLAY_SEARCH_FORM ) {
        search_box.select().focus();
    }
} // end of build_search_result_container()


function update_search_notice( search_notice ) {
    if ( ! result_content ) {
        return;
    }
    result_content.find('h3.search-notice').text( search_notice );
} // end of update_search_notice()


var build_search_result = (function() {
    var get_navi_link = (function() {
        var navi_link_template = $('<a href="#" />');
        
        return function( page_number, navi_text ) {
            return navi_link_template.clone( true ).text( navi_text ).click(function () {
                change_page( page_number );
                return false;
            });
        };
    })();
    
    var get_space = (function() {
        var space_template = $('<div/>').text(' ').contents();
        
        return function() {
            return space_template.clone( true );
        };
    })();
    
    return function( result_data, notice ) {
        if ( ! result_content ) {
            return;
        }
        
        var search_container = result_content.find('div.search-result-container').first(),
            old_page_navigations = search_container.find('div.page-navigation').empty(),
            page_navigation = old_page_navigations.first().clone( true ),
            old_search_result = search_container.find('ol.search-result').first().empty(),
            search_result = old_search_result.clone( true ),
            start_index = (current_page - 1) * ENTRY_PER_PAGE,
            last_index = result_data.length,
            encoded_keyword_string = encodeURIComponent( search_keywords.join(' ') );
        /*
        // 【覚書】
        //   DOMツリー上に存在したままノード（page_navigation等）の中身を更新した場合、異常に時間がかかるケースがあった。
        //   ※特に、テキストノードの操作は酷く時間がかかる模様。
        //   このため、複製した（DOMツリーからは切り離された状態の）ノードを更新した上で、元のノードと入れ替えている。
        */
        
        update_search_notice( notice );
        
        if ( 1 < current_page ) {
            page_navigation.append( get_navi_link( current_page - 1, '＜前へ' ) );
            page_navigation.append( get_space() );
        }
        
        for ( var ci=0; ci < (result_data.length / ENTRY_PER_PAGE); ci ++ ) {
            var page_number = ci + 1;
            if ( current_page == page_number ) {
                page_navigation.append( $('<span>' + page_number + '</span>') );
            } 
            else {
                page_navigation.append( get_navi_link( page_number, page_number ) );
            }
            //page_navigation.append( $('<span class="spacer" />').text(' ') );
            page_navigation.append( get_space() ); // DOMツリー上にある場合には、テキストノードの挿入は異常に時間がかかるので注意
        }
        
        if ( current_page < (result_data.length / ENTRY_PER_PAGE) ) {
            page_navigation.append( get_navi_link( current_page + 1, '次へ＞' ) );
        }
        
        old_page_navigations.each(function() {
            $(this).replaceWith( page_navigation.clone( true ) );
        });
        
        search_result.attr('start', start_index + 1);
        
        if ( ( (current_page) * ENTRY_PER_PAGE ) < result_data.length ) {
            last_index = current_page * ENTRY_PER_PAGE;
        }
        
        for ( var ci= start_index; ci < last_index; ci ++ ) {
            var entry = result_data[ci],
                li = $([
                    '<li>'
                ,   '  <a target="_blank"></a><br />'
                ,   escape_html( trunc_text( entry.body, search_keywords ) )
                ,   '</li>'
                ].join(''));
            
            li.find('a').first().attr( 'href', entry.link + '#search_word=' + encoded_keyword_string ).text( entry.title );
            
            search_result.append(li);
        }
        search_result.highlight( search_keywords );
        
        old_search_result.replaceWith( search_result );
    };
})(); // end of build_search_result()


function search( is_page_change ) {
    var is_hit = false;
    
    if ( search_keywords.length < 1 ) {
        return;
    }
    
    var search_notice = '',
        reg_keywords_list = [];
    
    $.each(search_keywords, function( index, keyword ) {
        reg_keywords_list.push( get_reg_keywords( [ keyword ] ) );
    })
    
    debug_log( 'keywords: ' + search_keywords.join(' ') );
    debug_log( '[before] search_counter = ' + search_counter + ' result_data.length = ' + result_data.length );
    for ( var ci = search_counter; ci < entries.length; ci ++ ) {
        var entry = entries[ ci ],
            is_match = true;
        
        $.each(reg_keywords_list, function( index, reg ) {
            if ( ( ! entry.title.match( reg ) ) && ( ! entry.body.match( reg ) ) ) {
                is_match = false;
                return false;
            }
        });
        
        if ( is_match ) {
            if ( ! matched_entry_map[ entry.link ] ) {
                matched_entry_map[ entry.link ] = true;
                result_data.push( entry );
                is_hit = true;
            }
        }
        search_counter ++;
    }
    debug_log( 'entries.length = ' + entries.length );
    debug_log( '[after]  search_counter = ' + search_counter + ' result_data.length = ' + result_data.length );
    
    if ( result_data.length == 0 ) {
        if ( backnumber_list.length <= loaded_backnumber_counter ) {
            search_notice = '一致しませんでした';
            is_hit = true;
        } 
        else {
            search_notice = '検索中... ' + Math.floor( ( loaded_backnumber_counter * 100 ) / backnumber_list.length )  + '%';
        }
    }
    else {
        if ( backnumber_list.length <= loaded_backnumber_counter ) {
            search_notice = '検索結果（' + result_data.length + '件ヒット）';
        }
        else {
            search_notice = '検索中...' + Math.floor( ( loaded_backnumber_counter * 100 )  / backnumber_list.length ) + '%（' + result_data.length + '件ヒット）';
        }
    }
    if ( is_hit || is_page_change ) {
        build_search_result( result_data, search_notice );
    }
    else {
        update_search_notice( search_notice );
    }
} // end of search()


function parse_backnumber( backnumber_html, backnumber_url ) {
    var page_document = get_simple_document( backnumber_html ),
        page_container = get_content_container( page_document );
    
    if ( page_container ) {
        if ( is_original_template() ) {
            page_container.find('div.entry').each(function() {
                var entry = $(this),
                    link = entry.find('a').first(),
                    body = entry.find('div.entry-body').first();
                
                entries.push({
                    title : trunc_spaces( link.text() )
                ,   body : trunc_spaces( body.text() )
                ,   link : link.attr('href')
                });
            });
        }
        else {
            page_container.find('div.entry').each(function() {
                var entry = $(this),
                    title = entry.find('h3').first(),
                    link = entry.find('a.permalink,h3 a').first(),
                    //body = entry.find('div.entry-body-text,div.entry-more');
                    body = entry.find('div.entry-body').first();
                
                entries.push({
                    title : trunc_spaces( title.text() )
                ,   body : trunc_spaces( body.text() )
                ,   link : link.attr('href')
                });
                
                if ( 1 < body.find('div.entry-body-text').size() ) {
                    var error_message = '※ HTML が壊れている可能性あり ' + backnumber_url;
                    console.error( error_message );
                    debug_log( error_message );
                    debug_log( entry );
                    debug_log( title );
                    debug_log( body );
                    debug_log( link );
                }
            });
        }
    }
    loaded_backnumber_counter ++;
    debug_log( 'loaded_backnumber_counter: ' + loaded_backnumber_counter + ' / ' + backnumber_list.length + ': ' + backnumber_url );
    debug_log( 'entries.length = ' + entries.length );
} // end of parse_backnumber()


var load_backnumber = (function() {
    function load_request( backnumber_info ) {
        var backnumber_url = backnumber_info.backnumber_url;
        
        debug_log( 'load backnumber: ' + backnumber_url );
        
        if ( backnumber_map[ backnumber_url ] ) {
            debug_log( '*** duplicate *** ' + backnumber_url ); // ここにはこないはず
            return;
        }
        backnumber_map[ backnumber_url ] = backnumber_info;
        
        backnumber_queue.push( backnumber_info );
        
        $.ajax({
            url: backnumber_url
        ,   type: 'GET'
        ,   data: {}
        ,   dataType: 'html'
        })
        .done(function( data, textStatus, jqXHR ) {
            backnumber_map[ backnumber_url ].backnumber_html = data;
        })
        .fail(function( jqXHR, textStatus, errorThrown ) {
            var error_text = backnumber_url + ' が読み込めませんでした (status: ' + textStatus + ')';
            console.error( error_text );
            debug_log( error_text );
            backnumber_map[ backnumber_url ].backnumber_html = '<html><body>' + error_text + '</body></html>';
        })
        .always(function( jqXHR, textStatus ) {
            var parse_count = 0;
            while ( ( 0 < backnumber_queue.length ) && ( backnumber_queue[0].backnumber_html ) ) {
                var backnumber_info = backnumber_queue.shift();
                parse_backnumber( backnumber_info.backnumber_html, backnumber_info.backnumber_url );
                backnumber_info.backnumber_html = null;
                parse_count ++;
            }
            if ( 0 < parse_count ) {
                search();
            }
            if ( backnumber_queue.length == 0 ) {
                load_backnumber();
            }
        });
        requested_backnumber_counter ++;
    }
    
    return function() {
        if ( backnumber_list.length <= loaded_backnumber_counter ) {
            search();
            return;
        } 
        for ( var ci = requested_backnumber_counter, limit = Math.min( backnumber_list.length, requested_backnumber_counter + MAX_CONCURRENT_LOAD ); ci < limit; ci++ ) {
            load_request( backnumber_list[ ci ] );
        }
    };
})(); // end of load_backnumber()


function parse_archive( archive_html, archive_file_path ) {
    var page_document = get_simple_document( archive_html ),
        page_container = get_content_container( page_document ),
        link_selector;
    
    if ( is_original_template() ) {
        link_selector = 'div.archive.archive-date-based a';
    }
    else {
        link_selector = 'div.archive-datebased a';
    }
    
    page_container.find( link_selector ).each(function() {
        var backnumber_url = $(this).attr('href');
        
        backnumber_list.push({
            backnumber_url : backnumber_url
        ,   backnumber_html : undefined
        });
    });
    
    load_backnumber();
} // end of parse_archive()


function load_archive_file( archive_file_path ) {
    if ( ( archive_file_path == last_archive_file_path ) && ( 0 < backnumber_list.length ) ) {
        load_backnumber();
        return;
    }
    
    last_archive_file_path = archive_file_path;
    
    requested_backnumber_counter = 0;
    loaded_backnumber_counter = 0;
    backnumber_list = [];
    backnumber_map = {};
    backnumber_queue = [];
    entries = [];
    
    debug_log( 'load archive: ' + archive_file_path );
    
    $.ajax({
        url: archive_file_path
    ,   type: 'GET'
    ,   data: {}
    ,   dataType: 'html'
    })
    .done(function( data, textStatus, jqXHR ) {
        parse_archive( data, archive_file_path );
    })
    .fail(function( jqXHR, textStatus, errorThrown ) {
        last_archive_file_path = null;
        alert(archive_file_path + ' が読み込めませんでした');
    });
    
} // end of load_archive_file()


function lookahead_backnumbers() {
    if ( ! is_lookahead ) {
        return;
    }
    is_lookahead = false;
    
    search_keywords = [];
    search_counter = 0;
    
    var archive_file_path = get_archive_file_path();
    
    load_archive_file( archive_file_path );
} // end of lookahead_backnumbers()


function cocologAjaxSearch() {
    var archive_file_path = get_archive_file_path(),
        text = '';
    
    if ( arguments.length < 2 ) {
        text = arguments[0];
    }
    else {
        // オリジナルの function cocologAjaxSearch( archive_file_path, text ) 互換用
        // ※当初は第1引数にアーカイブファイルの PATH を明示していたが、その後、第1引数は無視して自動的に取得するようになった
        //archive_file_path = arguments[1];
        text = arguments[1];
    }
    
    search_keywords = get_keywords( text );
    if ( search_keywords.length < 1 ) {
        return;
    }
    search_counter = 0;
    current_page = 1;
    result_data = [];
    matched_entry_map = {};
    
    build_search_result_container();
    
    scroll_to_node_top( result_content );
    
    load_archive_file( archive_file_path );
} // end of cocologAjaxSearch()


function change_page( new_page ) {
    scroll_to_node_top( result_content );
    
    current_page = new_page;
    
    search( true );
} // end of change_page()


function show_all_backnumbers() {
    var content = get_content_container(),
        ol = $('<ol type="1" start="1" style="text-align:left;"/>');
    
    $.each(entries, function( index, entry ) {
        var link = $('<a/>').attr( 'href', entry.link ).text( entry.title ),
            li = $('<li/>').append( link );
        ol.append( li );
    });
    
    content.empty().append( ol );
} // end of show_all_backnumbers()


function set_highlight_color( color ) {
    if ( ! color ) {
        color = HIGHLIGHT_COLOR;
        if ( ! color ) {
            return;
        }
    }
    $.setHighlightColor( color );
} // end of set_highlight_color()


function set_cocolog_ajax_search_options( options ) {
    if ( ! options ) {
        options = {}
    }
    if ( typeof options.debug != 'undefined' ) {
        DEBUG = options.debug;
    }
    if ( options.color ) {
        if ( $('<p/>').css('color', options.color).css('color') ) {
            HIGHLIGHT_COLOR = options.color;
            set_highlight_color();
        }
    }
    if ( options.truncation_length ) {
        var number = parseInt( options.truncation_length, 10 );
        if ( ( ! isNaN( number ) ) && ( 0 < number ) ) {
            TRUNCATION_LENGTH = number;
        }
    }
    if ( options.entry_per_page ) {
        var number = parseInt( options.entry_per_page, 10 );
        if ( ( ! isNaN( number ) ) && ( 0 < number ) ) {
            ENTRY_PER_PAGE = number;
        }
    }
    if ( options.max_concurrent_load ) {
        var number = parseInt( options.max_concurrent_load, 10 );
        if ( ( ! isNaN( number ) ) && ( 0 < number ) ) {
            MAX_CONCURRENT_LOAD = number;
        }
    }
    if ( typeof options.display_search_form != 'undefined' ) {
        DISPLAY_SEARCH_FORM = options.display_search_form;
    }
    if ( options.search_box_id ) {
        SEARCH_BOX_ID = options.search_box_id;
    }
    if ( options.search_credit_id ) {
        SEARCH_CREDIT_ID = options.search_credit_id;
    }
    if ( options.search_container_template ) {
        SEARCH_CONTAINER_TEMPLATE = options.search_container_template;
    }
} // end of set_cocolog_ajax_search_options()


function ligting_search_keyword() {
    var content = get_content_container();
    if ( ! content ) {
        return;
    }
    var query = window.location.href.replace(/.*?#/, ''),
        args = get_args( query ),
        keywords = get_keywords( args.search_word );
    
    if ( keywords.length < 1 ) {
        return;
    }
    content.find('h3').first().highlight( keywords );
    content.find('div.entry-body').highlight( keywords );
} // end of ligting_search_keyword()


function set_lookahead_action( search_box ) {
    if ( ! search_box ) {
        search_box = '#' + SEARCH_BOX_ID;
    }
    search_box = $(search_box);
    
    if ( search_box.size() < 1) {
        return;
    }
    search_box.focus(function() {
        lookahead_backnumbers();
    });
} // end of set_lookahead_action()


function set_credit( credit ) {
    if ( ! credit ) {
        credit = '#' + SEARCH_CREDIT_ID;
    }
    credit = $(credit);
    
    if ( credit.size() < 1 ) {
        return;
    }
    credit.empty().append( $('<a/>').attr( 'href', RELATED_URL ).text( SCRIPT_NAME ) );
} // end of set_credit()

//}


//{ ■ 外部提供用(グローバル)関数
window.cocologAjaxSearch = cocologAjaxSearch;
window.show_all_backnumbers = show_all_backnumbers; // テスト用
window.set_cocolog_ajax_search_options = set_cocolog_ajax_search_options;
window.set_highlight_color = set_highlight_color;
//}


//{ ■ エントリポイント
(function () {
    set_cocolog_ajax_search_options( window.cocolog_ajax_search_options );
    set_highlight_color();
    ligting_search_keyword();
    set_lookahead_action();
    set_credit();
})();
//}


});

})();
