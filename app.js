// 引入 express
const express = require('express'),
	  port = process.env.PORT || 3000,
	  app = express();
// 静态资源路径
const path = require('path');
app.use(express.static(path.join(__dirname, 'public')));
// 添加 ejs 引擎
app.engine('.html', require('ejs').renderFile);  
app.set('view engine', 'html');
// 路由配置
app.set('/', '.views');
// 表单验证中间件
const bodyParser = require('body-parser');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true}));
// 访问控制中间件
const session = require('express-session');
app.use(session({
	secret:'secret',
	resave:true,
	saveUninitialized:false,
	cookie:{
		maxAge:1000*60*30 //过期时间设置(单位毫秒)
	}
}));
app.use(function(req, res, next){
  	res.locals.user = req.session.user;
  	next();
});
// 对端口监听
app.listen(port);
// 数据库配置
const mongodb = require('mongodb'),
 	  server = new mongodb.Server('localhost',27017,{auto_reconnect:true}),
 	  db = new mongodb.Db('mydb',server,{safe:true}),
 	  url = 'mongodb://localhost:27017/budiubook';



// 首页
app.get('/', function(request, result){
	mongodb.connect(url, function(err, db){
		const coll = db.collection('bookstore');
		coll.find().toArray(function(err, res){
			if(!err){
				if(request.session.user){
					result.render('index', {
						user: request.session.user,
						booklist: res,
						login: true
					})
				}
				else{
					result.render('index', {
						user: request.session.user || '',
						booklist: res,
						login: false
					}) 
				}
			}
			else{
				console.log('index err');
			}
		})
	})
})

// 首页
app.get('/index', function(request, result){
	let step = Number(request.originalUrl.substring(7)) || 0;
		console.log('uuu:'+step);

	mongodb.connect(url, function(err, db){
		let booklen = 0; 
		const coll = db.collection('bookstore');
		// 页数
		coll.find().toArray(function(err, res){
			booklen = Math.ceil(res.length / 4);
		})
		coll.find().skip(step*4).limit(4).toArray(function(err, res){
			if(!err){
				if(request.session.user){
					result.render('index', {
						user: request.session.user,
						booklen: booklen,
						booklist: res,
						login: true
					})
				}
				else{
					result.render('index', {
						user: request.session.user || '',
						booklen: booklen,
						booklist: res,
						login: false
					}) 
				}
			}
			else{
				console.log('index err');
			}
		})
	})
})

// 登录页
app.get('/login', function(req, res){
	res.render('login', {
	})
})

// 登录处理
app.post('/login', function(request, result){	
	mongodb.connect(url, function(err, db){
		const user = {"user":request.body.name};
		const password = {"password":request.body.password};
		const data = {"user":request.body.name, "password":request.body.password};
		const dataAdmin = {"user":request.body.name, "password":request.body.password, "admin":true};
		const coll = db.collection('user');
		coll.find(user).toArray(function(err, res){
			if(res[0] != undefined && res[0].password == password.password){
				if(res[0].admin){
					request.session.user = dataAdmin;
				}
				else{
					request.session.user = data;
				}
				result.sendStatus(200);
			}
			else{
				result.sendStatus(500);
				console.log('login err');
			}
		})
	})
})

// 注册处理
app.post('/sign', function(request, result){
	mongodb.connect(url, function(err, db){
		const user = {"user":request.body.name};
		const data = {"user":request.body.name, "password":request.body.password};
		const coll = db.collection('user');
		coll.find(user).toArray(function(err, res){
			if(res[0] == undefined){
				coll.insert(data, function(err, res){
					console.log('inserted');
					result.sendStatus(200);
				})
			}
			else{
				result.sendStatus(500);
			}
		})
	})
})

// 个人页
app.get('/user', function(request, result){
	if(request.session.user){
		if(request.session.user.admin){
			result.render('user', {
			})
		}
		else{
			mongodb.connect(url, function(err, db){
				const user = {"user":request.session.user.user};
				const coll = db.collection('user');
				coll.find(user).toArray(function(error, res){
					result.render('user', {
						bookList: res[0].lease || []
					})
				})
			})
		}					
	}
	else{
		result.render('login', {
		})
	}
})

// 向我提交的申请页(管理员)
app.get('/note', function(request, result){
	mongodb.connect(url, function(err, db){
		const coll = db.collection('note');
		coll.find().sort({process:1, date:-1}).toArray(function(err, res){
			if(request.session.user){
				result.render('note', {
					applyList: res
				})
			}
			else{
				result.render('login', {
				})
			}
		})
	})	
})

// 同意申请处理(管理员)
app.post('/agree', function(request, result){
	mongodb.connect(url, function(err, db){
		const id = {"id" : Number(request.body.id)};
		let status = true;
		let order = false;
		if(request.body.type == true){
			data = { $set: {"status" : true, "order": false} };
		}
		else{
			data = { $set: {"status" : false} };
		}
		const bookstorecoll = db.collection('bookstore');
		const notecoll = db.collection('note');
		// const usercoll = db.collection('user');
		// 更新书角中这本书的状态
		bookstorecoll.update(id, data, function(err, res){
			if(!err){
				console.log('store updated');
				// 在申请表中更新这本书的处理进程
				let dataprocess = {$set: {"process": request.body.process}};
				notecoll.update(id, dataprocess, function(err, res){
					if(!err){
						console.log('note update');
						// 当流程结束，在申请表中封存这本书
						if(request.body.process=='C'){
							let dataid = {$set: {"id": 666}};
							notecoll.update(id, dataid, function(err, res){
								if(!err){
									console.log('id removed');
								}
								else{
									console.log('id remove err');
								}
							})
						}
						result.sendStatus(200);
					}
					else{
						console.log('update err');
					}
				})
				// 在个人借书单中移除这本书
				// const applicant = {"user":request.body.applicant};
				// usercoll.find(applicant).toArray(function(err, res){
				// 	for(let i = 0; i < res[0].lease.length; i++){
				// 		if(id.id == res[0].lease[i].id){
				// 			res[0].lease.splice(i, 1);
				// 			const update = { $set: {"lease" : res[0].lease} };
				// 			usercoll.update(applicant, update, function(err, res){
				// 				console.log('lease updated');
				// 			})
				// 		}
				// 	}
				// });
			}
			else{
				result.sendStatus(500);
				console.log('updated err !');
			}
		})
	})
})

// 编辑页(管理员)
app.get('/edit', function(request, result){
	if(request.session.user){
		result.render('edit', {
		})
	}
	else{
		result.render('login', {
		})
	}
})

// 图书编辑处理(管理员)
app.post('/edit', function(request, result){
	mongodb.connect(url, function(err, db){
		const data = { 
			"id" : Number(request.body.id),
			"name" : request.body.name,
			"publish" : request.body.publish,
			"author" : request.body.author,
			"year" : request.body.year,
			"owner" : request.body.owner,
			"link" : request.body.link,
			"status" : true,
			"order" : false
		};
		const coll = db.collection('bookstore');
		coll.insert(data, function(err, res){
			if(!err){
				console.log('book inserted !');
				result.sendStatus(200);
			}
			else{
				console.log('insert err');
				result.sendStatus(500);
			}
		})
	})
})
// 还书申请提交
// app.post('/back', function(request, result){
// 	mongodb.connect(url, function(err, db){
// 		const apply = {
// 			"id": Number(request.body.id),
// 			"name": request.body.name,
// 			"applicant": request.body.user,
// 			"link": request.body.link,
// 			"type": request.body.type
// 		};
// 		const coll = db.collection('note');
// 		coll.insert(apply, function(err, res){
// 			if(!err){
// 				console.log('apply inserted');
// 				result.sendStatus(200);
// 			}
// 			else{
// 				console.log('apply err');
// 				result.sendStatus(500);
// 			}
// 		})
// 	})
// })

// 提出借书申请(用户)
app.post('/borrow', function(request, result){
	if(request.session.user){
		mongodb.connect(url, function(err, db){
			const data = request.body;
			const notecoll = db.collection('note');
			notecoll.insert(data, function(){
				const id = {"id": request.body.id};
				const data = {$set: {"order": true}}
				const storecoll = db.collection('bookstore');
				storecoll.update(id, data, function(err, res){
					if(!err){
						console.log('ordered');
					}
					else{
						console.log('order err');
					}
				})
				result.sendStatus(200);
				console.log('borrow applied');
			})
		})
	}
	else{
		console.log('tologin');
		result.sendStatus(888);
	}
})

// 详情页
app.get('/detail', function(err, res){
	res.render('detail', {
	})
})










