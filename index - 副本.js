const { VideoBuilder } = require('fkbuilder');
const path = require('path');
const fs = require('fs');


function Creator(options={}){
	this.width=options.width||1920
	this.height=options.height||1080
	this.header=[]
	this.footer=[]
	this.slides=[]
}

// 添加片头封面场景
Creator.prototype.addCover=function(){
	
}

// 添加内容场景
Creator.prototype.addSlide=function(){
	
}

// 添加片尾
Creator.prototype.addFooter=function(){
	
}

// 导出视频
Creator.prototype.render=async function(){
	
}

module.exports=Creator