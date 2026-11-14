#include "kernel/types.h"
#include "kernel/stat.h"
#include "kernel/fcntl.h"
#include "user/user.h"

static void require(int ok, char *what) { if(!ok){fprintf(2,"lab: %s failed\n",what);exit(1);} }
int main(int argc, char **argv) {
 char *mode=argc>1?argv[1]:"pid";
 if(!strcmp(mode,"pid")) { printf("user pid=%d\n",getpid()); }
 else if(!strcmp(mode,"fork")) {
  int value=7, child=fork(); require(child>=0,"fork");
  if(child==0){value=99;printf("child value=%d\n",value);exit(23);}
  int status;wait(&status);printf("parent value=%d child status=%d\n",value,status);
 } else if(!strcmp(mode,"exec")) {
  printf("before exec pid=%d\n",getpid());char *args[]={"lab","pid",0};exec("lab",args);require(0,"exec");
 } else if(!strcmp(mode,"vm")) {
  char *before=sbrk(0), *page=sbrk(4096);require(page!=(char*)-1,"sbrk");
  page[0]=42;printf("heap grew=%d bytes value=%d\n",(int)(sbrk(0)-before),page[0]);sbrk(-4096);
 } else if(!strcmp(mode,"fault")) {
  int child=fork();require(child>=0,"fork");
  if(!child){printf("child will access unmapped address\n");*(volatile int*)0x40000000=1;exit(1);}
  int status;wait(&status);printf("parent survived child fault, status=%d\n",status);
 } else if(!strcmp(mode,"sleep")) {
  printf("sleeping for 3 timer ticks\n");sleep(3);printf("awake after timer wakeup\n");
 } else if(!strcmp(mode,"yield")) {
  int child=fork();require(child>=0,"fork");
  for(int i=0;i<3;i++){printf("%s turn %d\n",child?"parent":"child",i);sleep(1);}
  if(child)wait(0);
 } else if(!strcmp(mode,"fd")) {
  int fd=open("labfd",O_CREATE|O_RDWR|O_TRUNC);require(fd>=0,"open");
  write(fd,"ABC",3);close(fd);fd=open("labfd",O_RDONLY);int copy=dup(fd);char a=0,b=0;
  require(copy>=0,"dup");read(fd,&a,1);read(copy,&b,1);printf("shared offset: %c then %c\n",a,b);close(fd);close(copy);unlink("labfd");
 } else if(!strcmp(mode,"unlink")) {
  int fd=open("held",O_CREATE|O_RDWR|O_TRUNC);require(fd>=0,"open");write(fd,"alive",5);close(fd);
  fd=open("held",O_RDONLY);require(fd>=0,"open read");require(unlink("held")==0,"unlink");char b[6]={0};read(fd,b,5);printf("open descriptor still reads: %s\n",b);close(fd);
 } else if(!strcmp(mode,"pipe")) {
  int p[2];require(pipe(p)==0,"pipe");int child=fork();require(child>=0,"fork");
  if(!child){close(p[1]);char b[4]={0};int n=read(p[0],b,3);printf("reader got %d bytes: %s\n",n,b);printf("reader EOF=%d\n",read(p[0],b,1));close(p[0]);exit(0);}
  close(p[0]);sleep(2);write(p[1],"hey",3);close(p[1]);wait(0);
 } else if(!strcmp(mode,"file")) {
  int fd=open("blocks",O_CREATE|O_RDWR|O_TRUNC);require(fd>=0,"open");char block[1024];memset(block,'x',sizeof block);
  for(int i=0;i<14;i++) { require(write(fd,block,sizeof block)==sizeof block,"write block"); }
  close(fd);
  struct stat st;require(stat("blocks",&st)==0,"stat");printf("file size=%d bytes across direct and indirect blocks\n",st.size);unlink("blocks");
 } else if(!strcmp(mode,"links")) {
  unlink("original");unlink("alias");int fd=open("original",O_CREATE|O_WRONLY);require(fd>=0,"open");write(fd,"linked",6);close(fd);
  require(link("original","alias")==0,"link");unlink("original");char b[7]={0};fd=open("alias",O_RDONLY);require(fd>=0,"alias");read(fd,b,6);printf("alias reads: %s\n",b);close(fd);unlink("alias");
 } else {fprintf(2,"modes: pid fork exec vm fault sleep yield fd unlink pipe file links\n");exit(1);}
 exit(0);
}
